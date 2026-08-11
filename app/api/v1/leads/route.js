import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const fields = ["clienteId", "nome", "email", "telefone", "mensagem"];

function normalizeLead(body) {
  return Object.fromEntries(
    fields.map((field) => [
      field,
      typeof body?.[field] === "string" ? body[field].trim() : "",
    ]),
  );
}

function validateLead(lead) {
  const missingFields = fields.filter((field) => !lead[field]);

  if (missingFields.length) {
    return `Campos obrigatorios ausentes: ${missingFields.join(", ")}.`;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    return "E-mail invalido.";
  }

  if (lead.clienteId.length > 128) return "clienteId muito longo.";
  if (lead.nome.length > 120) return "Nome muito longo.";
  if (lead.email.length > 254) return "E-mail muito longo.";
  if (lead.telefone.length > 30) return "Telefone muito longo.";
  if (lead.mensagem.length > 5000) return "Mensagem muito longa.";

  return null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const lead = normalizeLead(body);
    const validationError = validateLead(lead);

    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }

    const documentReference = await getAdminDb().collection("leads").add({
      ...lead,
      createdAt: FieldValue.serverTimestamp(),
    });

    return Response.json(
      { id: documentReference.id, message: "Lead criado com sucesso." },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "JSON invalido." }, { status: 400 });
    }

    console.error("Erro ao criar lead:", error);
    return Response.json(
      { error: "Nao foi possivel criar o lead." },
      { status: 500 },
    );
  }
}
