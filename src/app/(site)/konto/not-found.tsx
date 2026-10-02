import { AccountScreen } from "@/components/account/AccountScreen";

export default function AccountNotFound() {
  return (
    <AccountScreen script="Zgubiliśmy krok" title="Nie ma takiej strony">
      <p className="text-cream">Ta strona konta nie jest dostępna.</p>
    </AccountScreen>
  );
}
