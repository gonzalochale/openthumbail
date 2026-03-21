import { Preview } from "@/components/preview";
import { GeneratePrompt } from "@/components/generate-prompt";
import { UserMenu } from "@/components/user-menu";

export default function Home() {
  return (
    <main className="w-full max-w-5xl mx-auto h-svh flex flex-col justify-center items-center p-5 pb-52">
      <UserMenu />
      <Preview />
      <GeneratePrompt />
    </main>
  );
}
