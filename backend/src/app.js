import express from "express";
import cors from "cors";
import supabase from "./database/supabase.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("*");

  if (error) {
    return res.status(500).json(error);
  }

  res.json(data);
});

export default app;