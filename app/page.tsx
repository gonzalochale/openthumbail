import { Preview } from "@/components/preview";
import { PromptInput } from "@/components/prompt-input";

export default function Home() {
  return (
    <main className="w-full max-w-7xl mx-auto h-svh flex flex-col justify-center items-center p-5 pb-52">
      <Preview />
      <PromptInput />
    </main>
  );
}
