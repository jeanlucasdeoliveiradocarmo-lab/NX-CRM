"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

function getTimestampInMillis(value) {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  return 0;
}

function formatDate(value) {
  const milliseconds = getTimestampInMillis(value);

  if (!milliseconds) return "Data indisponivel";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(milliseconds));
}

export default function DashboardPage() {
  const router = useRouter();
  const [leads, setLeads] = useState([]);
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setUserEmail(user.email || "Usuario");

      try {
        const leadsQuery = query(
          collection(db, "leads"),
          where("clienteId", "==", user.uid),
        );
        const snapshot = await getDocs(leadsQuery);
        const userLeads = snapshot.docs
          .map((leadDocument) => ({
            id: leadDocument.id,
            ...leadDocument.data(),
          }))
          .sort(
            (leadA, leadB) =>
              getTimestampInMillis(leadB.createdAt) -
              getTimestampInMillis(leadA.createdAt),
          );

        if (active) setLeads(userLeads);
      } catch (firestoreError) {
        console.error(firestoreError);
        if (active) setError("Nao foi possivel carregar os leads.");
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  const handleLogout = async () => {
  await signOut(auth);
  window.location.href = '/login';
};

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold text-blue-600">CRM Firebase</p>
            <h1 className="text-2xl font-bold text-slate-950">Dashboard de leads</h1>
          </div>
          <div className="flex items-center gap-4">
            <p className="hidden text-sm text-slate-500 sm:block">{userEmail}</p>
            <button
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={handleLogout}
              type="button"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-2xl bg-blue-600 p-6 text-white shadow-lg shadow-blue-600/20">
          <p className="text-sm font-medium text-blue-100">Total de leads</p>
          <p className="mt-1 text-4xl font-bold">{loading ? "—" : leads.length}</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-950">Seus contatos</h2>
            <p className="mt-1 text-sm text-slate-500">
              Somente leads vinculados ao seu UID sao exibidos.
            </p>
          </div>

          {loading ? (
            <p className="px-6 py-12 text-center text-slate-500">Carregando leads...</p>
          ) : error ? (
            <p className="m-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : leads.length === 0 ? (
            <p className="px-6 py-12 text-center text-slate-500">
              Nenhum lead encontrado para este usuario.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {["Nome", "Contato", "Mensagem", "Recebido em"].map((heading) => (
                      <th
                        className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                        key={heading}
                        scope="col"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {leads.map((lead) => (
                    <tr className="align-top hover:bg-slate-50" key={lead.id}>
                      <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-900">
                        {lead.nome}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        <a className="block hover:text-blue-600" href={`mailto:${lead.email}`}>
                          {lead.email}
                        </a>
                        <a className="mt-1 block hover:text-blue-600" href={`tel:${lead.telefone}`}>
                          {lead.telefone}
                        </a>
                      </td>
                      <td className="max-w-md px-6 py-4 text-sm leading-6 text-slate-600">
                        {lead.mensagem}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                        {formatDate(lead.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
