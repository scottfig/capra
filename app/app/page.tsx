import TaskInput from "@/components/TaskInput";

export default function AppPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Capra
          </h1>
          <p className="text-zinc-400">
            Enter a domain and a task. Watch a real AI agent attempt it against
            the product&apos;s docs — cold, from scratch.
          </p>
        </div>
        <TaskInput />
      </div>
    </main>
  );
}
