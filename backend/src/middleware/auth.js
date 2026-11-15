import jwt from "jsonwebtoken";

export default function (req, res, next) {

    const auth = req.headers.authorization;

    if (!auth)

        return res.status(401).json({
            erro: "Sem token"
        });

    const token = auth.split(" ")[1];

    try {

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch {

        return res.status(401).json({
            erro: "Token inválido"
        });

    }

}