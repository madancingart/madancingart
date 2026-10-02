"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AccountField, accountFieldClass } from "@/components/account/fields";
import { Button } from "@/components/ui/Button";
import { participantRpcMessage } from "@/lib/account/rpc-errors";
import { createClient } from "@/lib/supabase/client";
import type { CustomerKind, MyParticipantRow } from "@/lib/types";
import {
  childParticipantSchema,
  pairParticipantSchema,
  type ChildParticipantInput,
  type ChildParticipantValues,
  type PairParticipantInput,
  type PairParticipantValues,
} from "@/lib/validation";

const KIND_LABEL: Record<CustomerKind, string> = {
  adult: "Ty",
  pair: "Para",
  child: "Dziecko",
};

export function ParticipantsManager({
  participants,
  email,
  phone,
}: {
  participants: MyParticipantRow[];
  email: string;
  phone: string;
}) {
  const [adding, setAdding] = useState<"child" | "pair" | null>(null);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Kontakt do uczestników to dane konta: {phone}
        {email ? `, ${email}` : ""}.
      </p>
      {participants.length === 0 ? (
        <p className="text-sm text-cream">Nie masz jeszcze uczestników.</p>
      ) : (
        <ul className="space-y-3">
          {participants.map((person) => (
            <li key={person.id}>
              <ParticipantRow person={person} />
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding("child")}>
          Dodaj dziecko
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding("pair")}>
          Dodaj parę
        </Button>
      </div>
      {adding === "child" ? (
        <ChildForm onDone={() => setAdding(null)} />
      ) : null}
      {adding === "pair" ? <PairForm onDone={() => setAdding(null)} /> : null}
    </div>
  );
}

function displayName(person: MyParticipantRow): string {
  const primary = `${person.first_name} ${person.last_name}`;
  if (person.kind !== "pair") {
    return primary;
  }
  const partner = [person.partner_first_name, person.partner_last_name]
    .filter(Boolean)
    .join(" ");
  return partner ? `${primary} i ${partner}` : primary;
}

function ParticipantRow({ person }: { person: MyParticipantRow }) {
  const [editing, setEditing] = useState(false);

  return (
    <article className="border border-white/10 bg-black-soft p-4">
      <p className="text-xs tracking-wide text-gold">{KIND_LABEL[person.kind]}</p>
      {editing ? (
        person.kind === "pair" ? (
          <EditPair person={person} onClose={() => setEditing(false)} />
        ) : (
          <EditNames person={person} onClose={() => setEditing(false)} />
        )
      ) : (
        <div className="mt-1 flex items-start justify-between gap-3">
          <p className="text-cream">{displayName(person)}</p>
          <button
            type="button"
            className="shrink-0 text-sm text-gold"
            onClick={() => setEditing(true)}
          >
            Edytuj
          </button>
        </div>
      )}
    </article>
  );
}

function EditNames({
  person,
  onClose,
}: {
  person: MyParticipantRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChildParticipantInput, unknown, ChildParticipantValues>({
    resolver: zodResolver(childParticipantSchema),
    defaultValues: { firstName: person.first_name, lastName: person.last_name },
  });

  async function onSubmit(values: ChildParticipantValues) {
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("update_my_participant", {
      p_id: person.id,
      p_first_name: values.firstName,
      p_last_name: values.lastName,
      p_partner_first_name: null,
      p_partner_last_name: null,
    });
    if (rpcError) {
      setError(participantRpcMessage(rpcError.message));
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <form className="mt-3 space-y-3" onSubmit={handleSubmit(onSubmit)} noValidate>
      <NameFields
        idPrefix={`edit-${person.id}`}
        register={register}
        errors={errors}
        child={person.kind === "child"}
      />
      {error ? <p role="alert" className="text-sm text-[#E8A0A0]">{error}</p> : null}
      <FormActions pending={isSubmitting} onCancel={onClose} saveLabel="Zapisz" />
    </form>
  );
}

function EditPair({
  person,
  onClose,
}: {
  person: MyParticipantRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PairParticipantInput, unknown, PairParticipantValues>({
    resolver: zodResolver(pairParticipantSchema),
    defaultValues: {
      firstName: person.first_name,
      lastName: person.last_name,
      partnerFirstName: person.partner_first_name ?? "",
      partnerLastName: person.partner_last_name ?? "",
    },
  });

  async function onSubmit(values: PairParticipantValues) {
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("update_my_participant", {
      p_id: person.id,
      p_first_name: values.firstName,
      p_last_name: values.lastName,
      p_partner_first_name: values.partnerFirstName,
      p_partner_last_name: values.partnerLastName,
    });
    if (rpcError) {
      setError(participantRpcMessage(rpcError.message));
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <form className="mt-3 space-y-3" onSubmit={handleSubmit(onSubmit)} noValidate>
      <PairFields idPrefix={`edit-${person.id}`} register={register} errors={errors} />
      {error ? <p role="alert" className="text-sm text-[#E8A0A0]">{error}</p> : null}
      <FormActions pending={isSubmitting} onCancel={onClose} saveLabel="Zapisz" />
    </form>
  );
}

function ChildForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChildParticipantInput, unknown, ChildParticipantValues>({
    resolver: zodResolver(childParticipantSchema),
    defaultValues: { firstName: "", lastName: "" },
  });

  async function onSubmit(values: ChildParticipantValues) {
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("add_participant", {
      p_kind: "child",
      p_first_name: values.firstName,
      p_last_name: values.lastName,
      p_partner_first_name: null,
      p_partner_last_name: null,
    });
    if (rpcError) {
      setError(participantRpcMessage(rpcError.message));
      return;
    }
    router.refresh();
    onDone();
  }

  return (
    <form className="space-y-3 border border-white/10 bg-black-soft p-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className="text-base text-cream">Nowe dziecko</h2>
      <NameFields idPrefix="add-child" register={register} errors={errors} child />
      {error ? <p role="alert" className="text-sm text-[#E8A0A0]">{error}</p> : null}
      <FormActions pending={isSubmitting} onCancel={onDone} saveLabel="Dodaj dziecko" />
    </form>
  );
}

function PairForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PairParticipantInput, unknown, PairParticipantValues>({
    resolver: zodResolver(pairParticipantSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      partnerFirstName: "",
      partnerLastName: "",
    },
  });

  async function onSubmit(values: PairParticipantValues) {
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("add_participant", {
      p_kind: "pair",
      p_first_name: values.firstName,
      p_last_name: values.lastName,
      p_partner_first_name: values.partnerFirstName,
      p_partner_last_name: values.partnerLastName,
    });
    if (rpcError) {
      setError(participantRpcMessage(rpcError.message));
      return;
    }
    router.refresh();
    onDone();
  }

  return (
    <form className="space-y-3 border border-white/10 bg-black-soft p-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className="text-base text-cream">Nowa para</h2>
      <PairFields idPrefix="add-pair" register={register} errors={errors} />
      {error ? <p role="alert" className="text-sm text-[#E8A0A0]">{error}</p> : null}
      <FormActions pending={isSubmitting} onCancel={onDone} saveLabel="Dodaj parę" />
    </form>
  );
}

function NameFields({
  idPrefix,
  register,
  errors,
  child,
}: {
  idPrefix: string;
  register: ReturnType<typeof useForm<ChildParticipantInput, unknown, ChildParticipantValues>>["register"];
  errors: { firstName?: { message?: string }; lastName?: { message?: string } };
  child: boolean;
}) {
  return (
    <>
      <AccountField label={child ? "Imię dziecka" : "Imię"} htmlFor={`${idPrefix}-first`} error={errors.firstName?.message}>
        <input id={`${idPrefix}-first`} className={accountFieldClass} {...register("firstName")} />
      </AccountField>
      <AccountField label={child ? "Nazwisko dziecka" : "Nazwisko"} htmlFor={`${idPrefix}-last`} error={errors.lastName?.message}>
        <input id={`${idPrefix}-last`} className={accountFieldClass} {...register("lastName")} />
      </AccountField>
    </>
  );
}

function PairFields({
  idPrefix,
  register,
  errors,
}: {
  idPrefix: string;
  register: ReturnType<typeof useForm<PairParticipantInput, unknown, PairParticipantValues>>["register"];
  errors: {
    firstName?: { message?: string };
    lastName?: { message?: string };
    partnerFirstName?: { message?: string };
    partnerLastName?: { message?: string };
  };
}) {
  return (
    <>
      <AccountField label="Imię" htmlFor={`${idPrefix}-first`} error={errors.firstName?.message}>
        <input id={`${idPrefix}-first`} className={accountFieldClass} {...register("firstName")} />
      </AccountField>
      <AccountField label="Nazwisko" htmlFor={`${idPrefix}-last`} error={errors.lastName?.message}>
        <input id={`${idPrefix}-last`} className={accountFieldClass} {...register("lastName")} />
      </AccountField>
      <AccountField label="Imię partnera lub partnerki" htmlFor={`${idPrefix}-partner-first`} error={errors.partnerFirstName?.message}>
        <input id={`${idPrefix}-partner-first`} className={accountFieldClass} {...register("partnerFirstName")} />
      </AccountField>
      <AccountField label="Nazwisko partnera lub partnerki" htmlFor={`${idPrefix}-partner-last`} error={errors.partnerLastName?.message}>
        <input id={`${idPrefix}-partner-last`} className={accountFieldClass} {...register("partnerLastName")} />
      </AccountField>
    </>
  );
}

function FormActions({
  pending,
  onCancel,
  saveLabel,
}: {
  pending: boolean;
  onCancel: () => void;
  saveLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Zapisywanie…" : saveLabel}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        Anuluj
      </Button>
    </div>
  );
}
