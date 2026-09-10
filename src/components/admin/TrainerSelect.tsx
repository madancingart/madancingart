import { UNASSIGNED_TRAINER_LABEL } from "@/lib/trainers";
import type { TrainerRow } from "@/lib/types";

type TrainerSelectProps = {
  id?: string;
  value: string;
  trainers: Pick<TrainerRow, "id" | "name">[];
  required?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function TrainerSelect({
  id,
  value,
  trainers,
  required = false,
  disabled = false,
  onChange,
}: TrainerSelectProps) {
  return (
    <select
      id={id}
      required={required}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
    >
      {required ? (
        <option value="" disabled>
          Wybierz prowadzącego
        </option>
      ) : (
        <option value="">{UNASSIGNED_TRAINER_LABEL}</option>
      )}
      {value && !trainers.some((trainer) => trainer.id === value) ? (
        <option value={value}>{UNASSIGNED_TRAINER_LABEL}</option>
      ) : null}
      {trainers.map((trainer) => (
        <option key={trainer.id} value={trainer.id}>
          {trainer.name}
        </option>
      ))}
    </select>
  );
}
