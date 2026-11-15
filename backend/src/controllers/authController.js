import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import supabase from "../config/supabase.js";

export async function register(req, res) {

    const { nome, email, senha } = req.body;

    const senhaHash = await bcrypt.hash(senha, 10);

    const { data, error } = await supabase

        .from("users")

        .insert([
            {
                nome,
                email,
                senha: senhaHash
            }
        ]);

    if (error)
        return res.status(400).json(error);

    res.status(201).json({
        mensagem: "Usuário criado!"
    });
}

export async function login(req, res) {

    const { email, senha } = req.body;

    const { data } = await supabase

        .from("users")

        .select("*")

        .eq("email", email)

        .single();

    if (!data)

        return res.status(404).json({
            erro: "Usuário não encontrado"
        });

    const senhaCorreta = await bcrypt.compare(
        senha,
        data.senha
    );

    if (!senhaCorreta)

        return res.status(401).json({
            erro: "Senha incorreta"
        });

    const token = jwt.sign(
        {
            id: data.id
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "1d"
        }
    );

    res.json({
        token
    });
}