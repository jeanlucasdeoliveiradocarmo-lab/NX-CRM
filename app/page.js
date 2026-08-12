'use client';

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

const STATUS_OPTIONS = [
  { value: "novo", label: "Novo Lead" },
  { value: "atendimento", label: "Em Atendimento" },
  { value: "orcamento", label: "Orçamento Enviado" },
  { value: "fechado", label: "Venda Fechada" },
  { value: "perdido", label: "Perdido" },
];

const STATUS_CONFIG = {
  novo: {
    label: "Novo Lead",
    classes: "border-blue-300 bg-blue-100 text-blue-800",
  },
  atendimento: {
    label: "Em Atendimento",
    classes: "border-amber-300 bg-amber-100 text-amber-800",
  },
  orcamento: {
    label: "Orçamento Enviado",
    classes: "border-purple-300 bg-purple-100 text-purple-800",
  },
  fechado: {
    label: "Venda Fechada",
    classes: "border-emerald-300 bg-emerald-100 text-emerald-800",
  },
  perdido: {
    label: "Perdido",
    classes: "border-rose-300 bg-rose-100 text-rose-800",
  },
};

const FILTERS = [
  {
    value: "todos",
    label: "Todos",
    active: "border-[#0b44e8] bg-[#0b44e8] text-white",
    idle: "border-slate-200 bg-white text-slate-700 hover:border-blue-300",
  },
  {
    value: "novo",
    label: "Novos",
    active: "border-blue-600 bg-blue-600 text-white",
    idle: "border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-400",
  },
  {
    value: "atendimento",
    label: "Em Atendimento",
    active: "border-amber-500 bg-amber-500 text-white",
    idle: "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-400",
  },
  {
    value: "orcamento",
    label: "Orçamentos",
    active: "border-purple-600 bg-purple-600 text-white",
    idle: "border-purple-200 bg-purple-50 text-purple-800 hover:border-purple-400",
  },
  {
    value: "fechado",
    label: "Fechados",
    active: "border-emerald-600 bg-emerald-600 text-white",
    idle: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400",
  },
];

const ORIGIN_OPTIONS = [
  "Landing Page",
  "WhatsApp",
  "Instagram",
  "Indicação",
  "Presencial/Balcão",
];

const EMPTY_FORM = {
  nome: "",
  telefone: "",
  email: "",
  origem: "Landing Page",
  mensagem: "",
  status: "novo",
};

function getTimestampInMillis(value) {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  return 0;
}

function formatDate(value) {
  const milliseconds = getTimestampInMillis(value);

  if (!milliseconds) return "Agora";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(milliseconds));
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function getWhatsAppNumber(value) {
  const phone = normalizePhone(value);
  return phone.startsWith("55") ? phone : `55${phone}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [leads, setLeads] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("todos");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [updatingLeadId, setUpdatingLeadId] = useState("");
  const [deletingLeadId, setDeletingLeadId] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");

  useEffect(() => {
    let unsubscribeLeads = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (authenticatedUser) => {
      unsubscribeLeads();

      if (!authenticatedUser) {
        router.replace("/login");
        return;
      }

      setUser(authenticatedUser);
      setLoading(true);
      setError("");

      const leadsQuery = query(
        collection(db, "leads"),
        where("clienteId", "==", authenticatedUser.uid),
      );

      unsubscribeLeads = onSnapshot(
        leadsQuery,
        (snapshot) => {
          const userLeads = snapshot.docs
            .map((leadDocument) => ({
              id: leadDocument.id,
              ...leadDocument.data(),
              status: leadDocument.data().status || "novo",
            }))
            .sort(
              (leadA, leadB) =>
                getTimestampInMillis(leadB.createdAt) -
                getTimestampInMillis(leadA.createdAt),
            );

          setLeads(userLeads);
          setLoading(false);
          setError("");
        },
        (firestoreError) => {
          console.error(firestoreError);
          setError("Não foi possível carregar os leads.");
          setLoading(false);
        },
      );
    });

    return () => {
      unsubscribeLeads();
      unsubscribeAuth();
    };
  }, [router]);

  useEffect(() => {
    if (!isModalOpen) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape") setIsModalOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isModalOpen]);

  const counts = useMemo(
    () => ({
      todos: leads.length,
      novo: leads.filter((lead) => lead.status === "novo").length,
      atendimento: leads.filter((lead) => lead.status === "atendimento").length,
      orcamento: leads.filter((lead) => lead.status === "orcamento").length,
      fechado: leads.filter((lead) => lead.status === "fechado").length,
    }),
    [leads],
  );

  const filteredLeads = useMemo(
    () =>
      activeFilter === "todos"
        ? leads
        : leads.filter((lead) => lead.status === activeFilter),
    [activeFilter, leads],
  );

  function openLeadModal() {
    setForm(EMPTY_FORM);
    setFormError("");
    setIsModalOpen(true);
  }

  function updateForm(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function handleCreateLead(event) {
    event.preventDefault();

    if (!user) return;

    setIsSaving(true);
    setFormError("");

    try {
      await addDoc(collection(db, "leads"), {
        clienteId: user.uid,
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        email: form.email.trim().toLowerCase(),
        origem: form.origem,
        mensagem: form.mensagem.trim(),
        status: form.status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setForm(EMPTY_FORM);
      setIsModalOpen(false);
    } catch (firestoreError) {
      console.error(firestoreError);
      setFormError(
        "Não foi possível criar o lead. Verifique as regras do Firestore e tente novamente.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange(lead, status) {
    setUpdatingLeadId(lead.id);
    setError("");

    try {
      await updateDoc(doc(db, "leads", lead.id), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (firestoreError) {
      console.error(firestoreError);
      setError("Não foi possível atualizar o status do lead.");
    } finally {
      setUpdatingLeadId("");
    }
  }

  async function handleDeleteLead(lead) {
    const confirmed = window.confirm(
      `Excluir o lead ${lead.nome || "selecionado"}? Esta ação não pode ser desfeita.`,
    );

    if (!confirmed) return;

    setDeletingLeadId(lead.id);
    setError("");

    try {
      await deleteDoc(doc(db, "leads", lead.id));
    } catch (firestoreError) {
      console.error(firestoreError);
      setError("Não foi possível excluir o lead.");
    } finally {
      setDeletingLeadId("");
    }
  }

  async function handleCopyClientId() {
    if (!user?.uid) return;

    try {
      await navigator.clipboard.writeText(user.uid);
      setCopyFeedback("ID copiado!");
      window.setTimeout(() => setCopyFeedback(""), 2000);
    } catch (clipboardError) {
      console.error(clipboardError);
      setCopyFeedback("Não foi possível copiar");
    }
  }

  async function handleLogout() {
    await signOut(auth);
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-[#f4f7ff] text-slate-950">
      <header className="border-b border-blue-100 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-600 to-violet-700 text-lg font-black tracking-tight text-white shadow-lg shadow-blue-600/25">
              NX
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-[#071a57]">NX CRM</p>
              <h1 className="text-sm font-medium text-slate-500">Dashboard de Leads</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <p className="hidden text-sm text-slate-500 md:block">
              {user?.email || "Usuário conectado"}
            </p>
            <button
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
              onClick={handleLogout}
              type="button"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-[#071a57] via-[#0b44e8] to-[#5013d6] p-6 text-white shadow-xl shadow-blue-900/15 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                Visão comercial
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Seu funil, mais simples.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
                Cadastre oportunidades, acompanhe cada etapa e fale com seus leads em poucos cliques.
              </p>
            </div>

            <button
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-[#071a57] shadow-lg shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:bg-cyan-200 focus:outline-none focus:ring-4 focus:ring-cyan-200/40"
              onClick={openLeadModal}
              type="button"
            >
              + Criar Lead Manualmente
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                ID do Cliente
              </p>
              <p className="mt-2 truncate font-mono text-sm font-semibold text-slate-700">
                {user?.uid || "Carregando..."}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Use este código para vincular integrações e novos leads à sua conta.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {copyFeedback ? (
                <span className="text-xs font-semibold text-emerald-700" role="status">
                  {copyFeedback}
                </span>
              ) : null}
              <button
                className="rounded-xl bg-[#0b44e8] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0836ba] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!user?.uid}
                onClick={handleCopyClientId}
                type="button"
              >
                Copiar ID de Integração
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.value;

            return (
              <button
                aria-pressed={isActive}
                className={`rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  isActive ? filter.active : filter.idle
                }`}
                key={filter.value}
                onClick={() => setActiveFilter(filter.value)}
                type="button"
              >
                <span className="block text-2xl font-black">
                  {loading ? "—" : counts[filter.value]}
                </span>
                <span className="mt-1 block text-xs font-bold uppercase tracking-wide sm:text-sm">
                  {filter.label}
                </span>
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#071a57]">Leads</h2>
            <p className="mt-1 text-sm text-slate-500">
              {activeFilter === "todos"
                ? "Todos os contatos do seu funil."
                : `Filtro: ${STATUS_CONFIG[activeFilter]?.label || "Leads"}.`}
            </p>
          </div>
          <span className="text-sm font-semibold text-slate-500">
            {filteredLeads.length} {filteredLeads.length === 1 ? "lead" : "leads"}
          </span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-blue-100 bg-white px-6 py-16 text-center text-slate-500 shadow-sm">
            Carregando leads...
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-blue-200 bg-white px-6 py-16 text-center shadow-sm">
            <p className="font-bold text-slate-800">Nenhum lead neste filtro.</p>
            <p className="mt-1 text-sm text-slate-500">
              Crie um lead manualmente ou selecione outra etapa do funil.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredLeads.map((lead) => {
              const status = STATUS_CONFIG[lead.status] || STATUS_CONFIG.novo;
              const phone = normalizePhone(lead.telefone);

              return (
                <article
                  className="flex min-h-80 flex-col rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-900/10"
                  key={lead.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${status.classes}`}>
                        {status.label}
                      </span>
                      <h3 className="mt-3 truncate text-xl font-black tracking-tight text-[#071a57]">
                        {lead.nome || "Lead sem nome"}
                      </h3>
                    </div>
                    <button
                      aria-label={`Excluir lead ${lead.nome || "sem nome"}`}
                      className="rounded-lg border border-rose-100 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={deletingLeadId === lead.id}
                      onClick={() => handleDeleteLead(lead)}
                      type="button"
                    >
                      {deletingLeadId === lead.id ? "Excluindo..." : "Excluir"}
                    </button>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <a className="block truncate font-medium hover:text-blue-700" href={`mailto:${lead.email}`}>
                      {lead.email || "E-mail não informado"}
                    </a>
                    <a className="block font-medium hover:text-blue-700" href={`tel:${phone}`}>
                      {lead.telefone || "Telefone não informado"}
                    </a>
                    <p>
                      <span className="font-bold text-slate-700">Origem:</span>{" "}
                      {lead.origem || "Não informada"}
                    </p>
                  </div>

                  <div className="mt-4 flex-1 rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Observação / Mensagem
                    </p>
                    <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {lead.mensagem || "Nenhuma observação cadastrada."}
                    </p>
                  </div>

                  <div className="mt-4">
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`status-${lead.id}`}>
                      Alterar etapa
                    </label>
                    <select
                      className={`w-full rounded-xl border px-3 py-2 text-sm font-bold outline-none transition focus:ring-4 focus:ring-blue-100 ${status.classes}`}
                      disabled={updatingLeadId === lead.id}
                      id={`status-${lead.id}`}
                      onChange={(event) => handleStatusChange(lead, event.target.value)}
                      value={lead.status}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <a
                      className={`rounded-xl bg-emerald-600 px-3 py-2.5 text-center text-sm font-bold text-white transition hover:bg-emerald-700 ${
                        phone ? "" : "pointer-events-none opacity-50"
                      }`}
                      href={phone ? `https://wa.me/${getWhatsAppNumber(phone)}` : undefined}
                      rel="noreferrer"
                      target="_blank"
                    >
                      WhatsApp
                    </a>
                    <a
                      className={`rounded-xl bg-[#0b44e8] px-3 py-2.5 text-center text-sm font-bold text-white transition hover:bg-[#0836ba] ${
                        phone ? "" : "pointer-events-none opacity-50"
                      }`}
                      href={phone ? `tel:${phone}` : undefined}
                    >
                      Ligar
                    </a>
                  </div>

                  <p className="mt-3 text-right text-xs text-slate-400">
                    Recebido em {formatDate(lead.createdAt)}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {isModalOpen ? (
        <div
          aria-labelledby="new-lead-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#071a57]/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsModalOpen(false);
          }}
          role="dialog"
        >
          <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                  NX CRM
                </p>
                <h2 className="mt-1 text-xl font-black text-[#071a57]" id="new-lead-title">
                  Criar Lead Manualmente
                </h2>
              </div>
              <button
                aria-label="Fechar formulário"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 transition hover:bg-slate-200"
                onClick={() => setIsModalOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <form className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6" onSubmit={handleCreateLead}>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor="lead-name">
                  Nome
                </label>
                <input
                  autoFocus
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  id="lead-name"
                  maxLength={120}
                  onChange={(event) => updateForm("nome", event.target.value)}
                  required
                  type="text"
                  value={form.nome}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor="lead-phone">
                  Telefone
                </label>
                <input
                  autoComplete="tel"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  id="lead-phone"
                  maxLength={30}
                  onChange={(event) => updateForm("telefone", event.target.value)}
                  placeholder="(11) 99999-9999"
                  required
                  type="tel"
                  value={form.telefone}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor="lead-email">
                  E-mail
                </label>
                <input
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  id="lead-email"
                  maxLength={254}
                  onChange={(event) => updateForm("email", event.target.value)}
                  required
                  type="email"
                  value={form.email}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor="lead-origin">
                  Origem do Lead
                </label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  id="lead-origin"
                  onChange={(event) => updateForm("origem", event.target.value)}
                  value={form.origem}
                >
                  {ORIGIN_OPTIONS.map((origin) => (
                    <option key={origin} value={origin}>
                      {origin}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor="lead-message">
                  Observação / Mensagem
                </label>
                <textarea
                  className="min-h-28 w-full resize-y rounded-xl border border-slate-300 px-3.5 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  id="lead-message"
                  maxLength={5000}
                  onChange={(event) => updateForm("mensagem", event.target.value)}
                  placeholder="Contexto, interesse ou observações sobre o contato..."
                  value={form.mensagem}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor="lead-status">
                  Status Inicial
                </label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  id="lead-status"
                  onChange={(event) => updateForm("status", event.target.value)}
                  value={form.status}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {formError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:col-span-2" role="alert">
                  {formError}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-3 pt-1 sm:col-span-2 sm:flex-row sm:justify-end">
                <button
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  onClick={() => setIsModalOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="rounded-xl bg-gradient-to-r from-[#0b44e8] to-[#5013d6] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? "Salvando..." : "Salvar Lead"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}

