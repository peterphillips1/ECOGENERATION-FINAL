const pool = require("../../config/pool_conexoes");
const bcrypt = require("bcryptjs");

const usuariosModel = {

    create: async (dadosJson) => {
        try {
            // bcrypt.hash transforma a senha em hash seguro
            // o número 10 é o "custo" — 10 é o padrão recomendado
            const hashSenha = await bcrypt.hash(dadosJson.senha, 10);

            const [resultado] = await pool.query(
                "INSERT INTO usuarios (nome_usuario, email_usuario, senha_usuario, cpf_usuario, telefone_usuario, cep_usuario, numero_usuario, complemento_usuario, status_usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)",
                [dadosJson.nome, dadosJson.email, hashSenha, dadosJson.cpf || null, dadosJson.telefone || null, dadosJson.cep || null, dadosJson.numero || null, dadosJson.complemento || null]
            );
            return resultado;
        } catch (erro) {
            return erro;
        }
    },

    findByEmail: async (email) => {
        try {
            const [resultado] = await pool.query(
                "SELECT * FROM usuarios WHERE email_usuario = ? AND status_usuario = 1",
                [email]
            );
            return resultado;
        } catch (erro) {
            return erro;
        }
    },

    findByEmailAny: async (email) => {
        const [resultado] = await pool.query(
            "SELECT * FROM usuarios WHERE email_usuario = ?",
            [email]
        );
        return resultado;
    },

    findById: async (id) => {
        try {
            const [resultado] = await pool.query(
                "SELECT id_usuario, nome_usuario, email_usuario, cpf_usuario, status_usuario, telefone_usuario, cep_usuario, numero_usuario, complemento_usuario, imagem_perfil_usuario FROM usuarios WHERE id_usuario = ?",
                [id]
            );
            return resultado;
        } catch (erro) {
            return erro;
        }
    },

    findPasswordById: async (id) => {
        try {
            const [resultado] = await pool.query(
                "SELECT senha_usuario FROM usuarios WHERE id_usuario = ?",
                [id]
            );
            return resultado[0] ? resultado[0].senha_usuario : null;
        } catch (erro) {
            return erro;
        }
    },

    updateStatus: async (id, status) => {
        const [resultado] = await pool.query(
            "UPDATE usuarios SET status_usuario = ? WHERE id_usuario = ?",
            [status, id]
        );
        return resultado;
    },

    updatePassword: async (id, senha) => {
        const hashSenha = await bcrypt.hash(senha, 10);
        const [resultado] = await pool.query(
            "UPDATE usuarios SET senha_usuario = ? WHERE id_usuario = ?",
            [hashSenha, id]
        );
        return resultado;
    },

    delete: async (id) => {
        try {
            const [resultado] = await pool.query(
                "UPDATE usuarios SET status_usuario = 0 WHERE id_usuario = ?",
                [id]
            );
            return resultado;
        } catch (erro) {
            return erro;
        }
    },

    update: async (id, dadosJson) => {
        try {
            const campos = [
                "nome_usuario = ?",
                "telefone_usuario = ?",
                "cep_usuario = ?",
                "numero_usuario = ?",
                "complemento_usuario = ?"
            ];
            const valores = [dadosJson.nome, dadosJson.telefone, dadosJson.cep, dadosJson.numero, dadosJson.complemento];
            if (dadosJson.imagem !== undefined) {
                campos.push("imagem_perfil_usuario = ?");
                valores.push(dadosJson.imagem);
            }
            if (dadosJson.senha) {
                campos.push("senha_usuario = ?");
                valores.push(await bcrypt.hash(dadosJson.senha, 10));
            }
            valores.push(id);
            const [resultado] = await pool.query(
                `UPDATE usuarios SET ${campos.join(', ')} WHERE id_usuario = ?`,
                valores
            );
            return resultado;
        } catch (erro) {
            return erro;
        }
    }

}

module.exports = { usuariosModel };
