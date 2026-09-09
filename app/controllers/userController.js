const bcrypt = require("bcryptjs");
const { usuariosModel } = require("../models/usuariosModel");
const { diagnosticosModel } = require("../models/diagnosticosModel");
const { comprasModel } = require("../models/comprasModel");
const path = require('path');
const fs = require('fs');
const perfilDir = path.join(__dirname, '../public/imagens/perfil');

const consultarCep = async (cep) => {
    const numeros = String(cep || '').replace(/\D/g, '');
    if (numeros.length !== 8) return null;
    const response = await fetch(`https://viacep.com.br/ws/${numeros}/json/`);
    if (!response.ok) throw new Error('ViaCEP indisponível');
    const dados = await response.json();
    return dados.erro ? null : dados;
};

// ===== PERFIL DO USUÁRIO =====
exports.perfil = async (req, res) => {
    try {
        const usuarios = await usuariosModel.findById(req.session.usuarioId);
        const usuario = usuarios[0];
        const diagnosticos = await diagnosticosModel.findByUsuario(req.session.usuarioId);
        const compras = await comprasModel.findByUsuario(req.session.usuarioId);
        let endereco = null;
        let erroCep = false;
        try { endereco = await consultarCep(usuario.cep_usuario); } catch (erro) { erroCep = true; }
        res.render('perfil', {
            titulo: 'Meu Perfil',
            usuario,
            diagnosticos,
            compras,
            endereco,
            erroCep
        });
    } catch (erro) {
        console.log(erro);
        res.redirect('/');
    }
};

exports.atualizarPerfil = async (req, res) => {
    const id = req.session.usuarioId;
    let imagemAnterior;
    try {
        const nome = String(req.body.nome || '').trim();
        const telefone = String(req.body.telefone || '').trim();
        const cep = String(req.body.cep || '').trim();
        const senhaAtual = String(req.body.senha_atual || '').trim();
        const senha = String(req.body.senha || '').trim();
        const confirmarSenha = String(req.body.confirmarSenha || '').trim();

        const desejaAlterarSenha = Boolean(senhaAtual || senha || confirmarSenha);
        if (desejaAlterarSenha) {
            if (!senhaAtual || !senha || !confirmarSenha) {
                req.session.flash = { status: 'error', text: 'Para alterar a senha, informe a senha atual, a nova senha e a confirmação.' };
                return res.redirect('/perfil');
            }
            if (senha.length < 6 || senha.length > 72) {
                req.session.flash = { status: 'error', text: 'A nova senha deve ter entre 6 e 72 caracteres.' };
                return res.redirect('/perfil');
            }
            if (senha !== confirmarSenha) {
                req.session.flash = { status: 'error', text: 'A confirmação da nova senha não confere.' };
                return res.redirect('/perfil');
            }
            const hashAtual = await usuariosModel.findPasswordById(id);
            if (typeof hashAtual !== 'string' || !(await bcrypt.compare(senhaAtual, hashAtual))) {
                req.session.flash = { status: 'error', text: 'Senha atual incorreta.' };
                return res.redirect('/perfil');
            }
        }

        if (!nome || nome.length > 100 || (telefone && !/^\(\d{2}\)\s?\d{5}-\d{4}$/.test(telefone)) ||
            (cep && !/^\d{5}-?\d{3}$/.test(cep))) {
            req.session.flash = { status: 'error', text: 'Verifique os dados informados no perfil.' };
            return res.redirect('/perfil');
        }

        const usuarios = await usuariosModel.findById(id);
        if (!usuarios[0]) return res.redirect('/login');
        imagemAnterior = usuarios[0].imagem_perfil_usuario;
        const imagem = req.file ? `imagens/perfil/${req.file.filename}` : undefined;
        const dadosAtualizacao = {
            nome,
            telefone: telefone || null,
            cep: cep || null,
            numero: String(req.body.numero || '').trim() || null,
            complemento: String(req.body.complemento || '').trim() || null,
            imagem
        };

        if (desejaAlterarSenha) {
            dadosAtualizacao.senha = senha;
        }

        await usuariosModel.update(id, dadosAtualizacao);
        if (req.file && imagemAnterior && imagemAnterior.startsWith(`imagens/perfil/perfil_${id}_`)) {
            const antigo = path.basename(imagemAnterior);
            const caminho = path.join(perfilDir, antigo);
            if (caminho.startsWith(perfilDir) && fs.existsSync(caminho)) fs.unlinkSync(caminho);
        }
        req.session.usuarioNome = nome;
        req.session.flash = { status: 'success', text: 'Perfil atualizado com sucesso.' };
        req.session.save(() => res.redirect('/perfil'));
    } catch (erro) {
        console.log(erro);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        req.session.flash = { status: 'error', text: 'Erro ao atualizar o perfil. Verifique os dados e tente novamente.' };
        res.redirect('/perfil');
    }
};

// ===== EXCLUIR CONTA =====
exports.excluirConta = async (req, res) => {
    try {
        await usuariosModel.delete(req.session.usuarioId);
        req.session.flash = { status: 'success', text: 'Sua conta foi removida com sucesso.' };
        req.session.save(() => {
            req.session.destroy();
            res.redirect('/login');
        });
    } catch (erro) {
        console.log(erro);
        req.session.flash = { status: 'error', text: 'Erro ao excluir conta. Tente novamente.' };
        res.redirect('/perfil');
    }
};

exports.consultarCep = consultarCep;
