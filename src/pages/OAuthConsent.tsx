import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Minimal typed wrapper — `supabase.auth.oauth` is beta and may be missing from types.
type OAuthMethods = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
function oauth(): OAuthMethods {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = (supabase.auth as any).oauth;
  if (!a) throw new Error("Supabase OAuth 2.1 authorization server is not enabled on this project.");
  return a;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id in URL.");
        return;
      }
      try {
        const { data, error: detailsErr } = await oauth().getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (detailsErr) {
          setError(detailsErr.message);
          return;
        }
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { data, error: decideErr } = approve
        ? await oauth().approveAuthorization(authorizationId)
        : await oauth().denyAuthorization(authorizationId);
      if (decideErr) {
        setBusy(false);
        setError(decideErr.message);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        setError("The authorization server did not return a redirect URL.");
        return;
      }
      window.location.href = target;
    } catch (e) {
      setBusy(false);
      setError((e as Error).message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connect to Arm Stats</CardTitle>
          <CardDescription>
            {error
              ? "We couldn't load this authorization request."
              : details
                ? `${details.client?.name ?? "An application"} is asking to access Arm Stats as you.`
                : "Loading authorization request…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {details && !error && (
            <>
              <p className="text-sm text-muted-foreground">
                It will act as you when calling Arm Stats tools — your team-based access rules still apply.
              </p>
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => decide(true)} className="flex-1">
                  Approve
                </Button>
                <Button disabled={busy} onClick={() => decide(false)} variant="outline" className="flex-1">
                  Deny
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
