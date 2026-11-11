import { Landing } from "@/components/landing";
export const dynamic = "force-dynamic";
export default function Home() {
  return (
    <Landing
      aiReady={!!(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL)}
      paypalReady={
        !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
      }
    />
  );
}
