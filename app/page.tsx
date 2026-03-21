import { Preview } from "@/components/preview";
import { GeneratePrompt } from "@/components/generate-prompt";
import { UserMenu } from "@/components/user-menu";
import { PaymentReturnHandler } from "@/components/payment-return-handler";

export default function Home() {
  return (
    <main className="relative w-full max-w-360 mx-auto h-svh flex flex-col justify-center items-center p-5 pb-24">
      <UserMenu />
      <Preview />
      <GeneratePrompt />
      <PaymentReturnHandler />
    </main>
  );
}
