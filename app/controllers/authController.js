const bcrypt = require("bcryptjs");
const { validationResult } = require('express-validator');
const { usuariosModel } = require("../models/usuariosModel");
const { criarToken, verificarToken, getBaseUrl } = require('../helpers/tokens');
const { enviarEmail, criarTemplateAtivacaoConta, criarTemplateResetSenha } = require('../services/emailService');

// ===== CADASTRO =====
exports.cadastroForm = (req, res) => {
    res.render('cadastro', { titulo: 'Cadastro', old: {}, errors: {} });
};

exports.cadastroSubmit = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('cadastro', { old: req.body, errors: errors.mapped() });
    }
    try {
        const existente = await usuariosModel.findByEmailAny(req.body.email);
        if (existente.length > 0) {
            return res.render('cadastro', {
                old: req.body,
                errors: { email: { msg: 'Este e-mail já está cadastrado.' } }
            });
        }
        const resultado = await usuariosModel.create({
            nome: req.body.nome,
            email: req.body.email,
            senha: req.body.senha,
            cpf: req.body.cpf,
            telefone: req.body.telefone,
            cep: req.body.cep,
            numero: req.body.numero,
            complemento: req.body.complemento
        });
        if (!resultado || !resultado.insertId) throw new Error('Usuário não foi criado');
        const token = criarToken({ id_usuario: resultado.insertId, tipo: 'ativacao' }, '24h');
        const appBaseUrl = getBaseUrl();
        const html = criarTemplateAtivacaoConta({
            nomeUsuario: req.body.nome,
            appBaseUrl,
            token
        });
        try {
            await enviarEmail({
                para: req.body.email,
                assunto: 'Ative sua conta EcoGeneration',
                html
            });
            req.session.flash = { status: 'success', text: 'Cadastro realizado! Verifique seu e-mail para ativar a conta.' };
        } catch (emailErro) {
            console.log(emailErro);
            req.session.flash = { status: 'error', text: 'Cadastro criado, mas não foi possível enviar o e-mail de ativação.' };
        }
        console.log('FLASH GRAVADO (cadastro):', req.session.flash);
        req.session.save(() => res.redirect('/login'));
    } catch (erro) {
        console.log(erro);
        res.render('cadastro', { old: req.body, errors: { geral: { msg: 'Erro ao cadastrar. Tente novamente.' } } });
    }
};

// ===== LOGIN =====
exports.loginForm = (req, res) => {
    res.render('login', { errors: {}, old: {} });
};

exports.loginSubmit = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('login', { errors: errors.mapped(), old: req.body });
    }
    try {
        const usuarios = await usuariosModel.findByEmailAny(req.body.email);
        if (usuarios.length === 0) {
            return res.render('login', {
                errors: { geral: { msg: 'E-mail não cadastrado.' } },
                old: req.body
            });
        }
        const usuario = usuarios[0];
        if (usuario.status_usuario !== 1) {
            return res.render('login', {
                errors: { geral: { msg: 'Ative sua conta pelo link enviado por e-mail antes de entrar.' } },
                old: req.body
            });
        }
        const senhaCorreta = await bcrypt.compare(req.body.senha, usuario.senha_usuario);
        if (!senhaCorreta) {
            return res.render('login', {
                errors: { geral: { msg: 'Email ou senha inválidos.' } },
                old: req.body
            });
        }
        req.session.usuarioLogado = true;
        req.session.usuarioId = usuario.id_usuario;
        req.session.usuarioNome = usuario.nome_usuario;
        req.session.flash = { status: 'success', text: `Bem-vindo(a) de volta, ${usuario.nome_usuario.split(' ')[0]}!` };
        console.log('FLASH GRAVADO (login):', req.session.flash);
        console.log('SESSION ID:', req.sessionID);
        req.session.save(() => res.redirect('/'));
    } catch (erro) {
        console.log(erro);
        res.render('login', {
            errors: { geral: { msg: 'Erro ao fazer login. Tente novamente.' } },
            old: req.body
        });
    }
};

exports.ativarConta = async (req, res) => {
    try {
        const dados = verificarToken(req.query.token);
        if (dados.tipo !== 'ativacao') throw new Error('Token inválido');
        const usuarios = await usuariosModel.findById(dados.id_usuario);
        if (!usuarios[0]) return res.render('login', { errors: { geral: { msg: 'Usuário não encontrado.' } }, old: {} });
        if (usuarios[0].status_usuario === 1) {
            req.session.flash = { status: 'success', text: 'Sua conta já está ativa.' };
        } else {
            await usuariosModel.updateStatus(dados.id_usuario, 1);
            req.session.flash = { status: 'success', text: 'Conta ativada com sucesso! Você já pode entrar.' };
        }
        req.session.save(() => res.redirect('/login'));
    } catch (erro) {
        req.session.flash = { status: 'error', text: erro.name === 'TokenExpiredError' ? 'O link de ativação expirou.' : 'Link de ativação inválido.' };
        req.session.save(() => res.redirect('/login'));
    }
};

exports.recuperarSenhaForm = (req, res) => res.render('recuperar-senha', { errors: {}, old: {} });

exports.recuperarSenhaSubmit = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('recuperar-senha', { old: req.body, errors: { geral: errors.array()[0] } });
    }
    const email = String(req.body.email || '').trim();
    try {
        const usuarios = await usuariosModel.findByEmailAny(email);

        if (usuarios.length === 0) {
            return res.render('recuperar-senha', {
                old: req.body,
                errors: { geral: { msg: 'E-mail não encontrado. Verifique se digitou corretamente ou cadastre-se.' } }
            });
        }

        if (usuarios[0].status_usuario !== 1) {
            return res.render('recuperar-senha', {
                old: req.body,
                errors: { geral: { msg: 'Essa conta ainda não foi ativada. Verifique o e-mail de ativação que enviamos no cadastro.' } }
            });
        }

        const token = criarToken({ id_usuario: usuarios[0].id_usuario, tipo: 'reset' }, '1h');
        const appBaseUrl = getBaseUrl();
        const html = criarTemplateResetSenha({
            nomeUsuario: usuarios[0].nome_usuario,
            appBaseUrl,
            token
        });
        await enviarEmail({
            para: email,
            assunto: 'Redefinição de senha EcoGeneration',
            html
        });

        req.session.flash = { status: 'success', text: 'Enviamos um link de redefinição para o seu e-mail.' };
        req.session.save(() => res.redirect('/login'));
    } catch (erro) {
        console.log(erro);
        return res.render('recuperar-senha', {
            old: req.body,
            errors: { geral: { msg: 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.' } }
        });
    }
};

exports.resetarSenhaForm = (req, res) => {
    try {
        const dados = verificarToken(req.query.token);
        if (dados.tipo !== 'reset') throw new Error('Token inválido');
        res.render('resetar-senha', { token: req.query.token, errors: {} });
    } catch (erro) {
        res.render('login', { errors: { geral: { msg: erro.name === 'TokenExpiredError' ? 'O link de redefinição expirou.' : 'Link de redefinição inválido.' } }, old: {} });
    }
};

exports.resetarSenhaSubmit = async (req, res) => {
    const token = req.body.token;
    try {
        const dados = verificarToken(token);
        if (dados.tipo !== 'reset') throw new Error('Token inválido');

        const senha = req.body.senha || '';
        const confirmarSenha = req.body.confirmarSenha || '';
        if (senha.length < 6) {
            return res.render('resetar-senha', { token, errors: { geral: { msg: 'A senha deve ter pelo menos 6 caracteres.' } } });
        }
        if (senha !== confirmarSenha) {
            return res.render('resetar-senha', { token, errors: { geral: { msg: 'As senhas digitadas não coincidem.' } } });
        }

        const usuarios = await usuariosModel.findById(dados.id_usuario);
        if (!usuarios[0]) throw new Error('Usuário não encontrado');
        await usuariosModel.updatePassword(dados.id_usuario, senha);
        req.session.flash = { status: 'success', text: 'Senha redefinida com sucesso. Faça login.' };
        req.session.save(() => res.redirect('/login'));
    } catch (erro) {
        req.session.flash = { status: 'error', text: erro.name === 'TokenExpiredError' ? 'O link de redefinição expirou. Solicite um novo.' : 'Link inválido ou expirado. Solicite um novo.' };
        req.session.save(() => res.redirect('/recuperar-senha'));
    }
};

// ===== LOGOUT =====
exports.logout = (req, res) => {
    req.session.flash = { status: 'success', text: 'Você saiu da sua conta. Até logo!' };
    req.session.usuarioLogado = null;
    req.session.usuarioNome = null;
    req.session.usuarioEmail = null;
    req.session.usuarioId = null;
    console.log('FLASH GRAVADO (logout):', req.session.flash);
    req.session.save(() => {
        // Destruir sessão APÓS a próxima página renderizar (via timeout curto)
        setTimeout(() => {
            req.session.destroy(() => {});
        }, 100);
        res.redirect('/login');
    });
};