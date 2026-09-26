import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Fantasy Hockey Draft Prep</h1>
      <form
        action={async () => {
          "use server";
          await signIn("discord", { redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="rounded-md bg-[#5865F2] px-5 py-2.5 font-medium text-white hover:bg-[#4752C4]"
        >
          Sign in with Discord
        </button>
      </form>
    </main>
  );
}
