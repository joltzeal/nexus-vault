import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/aicanvas/andromeda/components/Button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/aicanvas/andromeda/components/Card";
import { Input } from "@/components/aicanvas/andromeda/components/Input";
import { Textarea } from "@/components/aicanvas/andromeda/components/Textarea";
import { Toggle } from "@/components/aicanvas/andromeda/components/Toggle";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/motion/tabs";
import { toast } from "@/components/ui/toast";
import {
  getAccountIntegrations,
  updateXComCookie,
  type GlobalIntegrations,
  type SettingsUser,
} from "@/features/settings";
import { authClient } from "@/lib/auth";
import { useDocumentTitle } from "@/hooks/use-document-title";

export type SettingsPageProps = {
  mediaVisible: boolean;
  onMediaVisibleChange: (visible: boolean) => void;
  user?: SettingsUser;
};

export function SettingsPage({
  mediaVisible,
  onMediaVisibleChange,
  user,
}: SettingsPageProps) {
  useDocumentTitle("Settings · Nexus Vault");
  const [activeModule, setActiveModule] = useState("general");
  const [integrations, setIntegrations] = useState<GlobalIntegrations | null>(
    null,
  );
  const [cookieString, setCookieString] = useState("");
  const [integrationBusy, setIntegrationBusy] = useState(false);
  const [integrationError, setIntegrationError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    confirmPassword: "",
    currentPassword: "",
    newPassword: "",
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getAccountIntegrations()
      .then((data) => {
        if (!cancelled) setIntegrations(data);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setIntegrationError(
            error instanceof Error
              ? error.message
              : "Could not load integrations.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function saveXComCookie(nextCookieString: string) {
    if (!user) return;
    try {
      setIntegrationBusy(true);
      setIntegrationError("");
      setIntegrations(await updateXComCookie(nextCookieString));
      setCookieString("");
      toast.add({
        title: nextCookieString.trim()
          ? "x.com cookie saved"
          : "x.com cookie cleared",
        type: "success",
      });
    } catch (error) {
      setIntegrationError(
        error instanceof Error
          ? error.message
          : "Could not save the x.com cookie.",
      );
    } finally {
      setIntegrationBusy(false);
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const { confirmPassword, currentPassword, newPassword } = passwordForm;
    if (!currentPassword || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    try {
      setPasswordBusy(true);
      setPasswordError("");
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setPasswordError(
          result.error.message ?? "Could not update your password.",
        );
        return;
      }
      setPasswordForm({
        confirmPassword: "",
        currentPassword: "",
        newPassword: "",
      });
      toast.add({ title: "Password updated", type: "success" });
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "Could not update your password.",
      );
    } finally {
      setPasswordBusy(false);
    }
  }

  const xComConfigured = integrations?.xCom?.cookieConfigured ?? false;
  const currentName = user?.name || "Guest";
  const currentEmail = user?.email || "Please sign in";

  return (
    <div className="mx-auto w-full max-w-5xl pb-12">
      <DashboardPageHeader
        breadcrumb="~/settings"
        description="Manage workspace defaults."
        title="Settings"
      />
      <Tabs
        className="block w-full"
        onValueChange={setActiveModule}
        value={activeModule}
        variant="underline"
      >
        <section className="w-full overflow-hidden border border-border bg-card">
          <div className="flex min-h-9 items-center gap-1.5 border-b border-border px-3 font-mono text-label text-muted-foreground">
            <span className="font-bold text-primary">❯</span>
            <span>~/config/nexus-vault/</span>
            <b className="font-medium text-foreground">settings.conf</b>
            <span className="flex-1" />
            <span className="font-bold tracking-[0.08em] text-primary">
              [rw]
            </span>
          </div>
          <TabsList className="flex min-h-10 w-full items-end justify-start gap-0 rounded-none border-b border-border bg-transparent px-3">
            <TabsTrigger
              className="!min-h-9 rounded-none border border-transparent border-b-0 px-3 font-mono text-label uppercase tracking-[0.08em]"
              value="general"
            >
              <span aria-hidden="true" className="mr-1 text-primary">
                &gt;
              </span>
              [General]
            </TabsTrigger>
            <TabsTrigger
              className="!min-h-9 rounded-none border border-transparent border-b-0 px-3 font-mono text-label uppercase tracking-[0.08em]"
              value="integrations"
            >
              <span aria-hidden="true" className="mr-1 text-primary">
                &gt;
              </span>
              [Integrations]
            </TabsTrigger>
          </TabsList>
          <TabsContent className="p-3" value="general">
            <div className="grid gap-3">
              <Card
                bordered
                className="overflow-hidden rounded-none border-border bg-background"
              >
                <CardHeader className="min-h-9 border-b border-border px-3 py-0 font-mono text-label uppercase tracking-[0.08em] text-muted-foreground">
                  <span className="text-primary">❯</span> Account
                  <span className="ml-auto text-[10px] font-normal tracking-[0.05em]">
                    READ ONLY
                  </span>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                  <div>
                    <p className="text-label text-muted-foreground">
                      Display name
                    </p>
                    <p className="mt-1 truncate text-ui font-medium">
                      {currentName}
                    </p>
                  </div>
                  <div className="border-t border-border pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-3">
                    <p className="text-label text-muted-foreground">Email</p>
                    <p className="mt-1 truncate text-ui font-medium">
                      {currentEmail}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card
                bordered
                className="overflow-hidden rounded-none border-border bg-background"
              >
                <CardHeader className="min-h-9 border-b border-border px-3 py-0 font-mono text-label uppercase tracking-[0.08em] text-muted-foreground">
                  <span className="text-primary">❯</span> Preferences
                </CardHeader>
                <CardContent className="flex min-h-[58px] items-center gap-4 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-ui font-medium">Sensitive media</p>
                    <p className="mt-0.5 text-label text-muted-foreground">
                      Show media marked as sensitive.
                    </p>
                  </div>
                  <Toggle
                    checked={mediaVisible}
                    className="rounded-none border-border bg-background"
                    disabled={!user}
                    onCheckedChange={onMediaVisibleChange}
                  />
                </CardContent>
              </Card>
              <Card
                bordered
                className="overflow-hidden rounded-none border-border bg-background"
              >
                <CardHeader className="min-h-9 border-b border-border px-3 py-0 font-mono text-label uppercase tracking-[0.08em] text-muted-foreground">
                  <span className="text-primary">❯</span> Security
                  <span className="ml-auto text-[10px] font-normal tracking-[0.05em]">
                    PASSWORD
                  </span>
                </CardHeader>
                <CardContent className="p-3">
                  <form className="grid gap-3" onSubmit={handleChangePassword}>
                    <p className="text-label text-muted-foreground">
                      Updating your password signs out other sessions.
                    </p>
                    <Input
                      aria-label="Current password"
                      autoComplete="current-password"
                      disabled={!user || passwordBusy}
                      label="Current password"
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setPasswordForm((form) => ({
                          ...form,
                          currentPassword: event.target.value,
                        }))
                      }
                      type="password"
                      value={passwordForm.currentPassword}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        aria-label="New password"
                        autoComplete="new-password"
                        disabled={!user || passwordBusy}
                        label="New password"
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setPasswordForm((form) => ({
                            ...form,
                            newPassword: event.target.value,
                          }))
                        }
                        type="password"
                        value={passwordForm.newPassword}
                      />
                      <Input
                        aria-label="Confirm password"
                        autoComplete="new-password"
                        disabled={!user || passwordBusy}
                        label="Confirm password"
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setPasswordForm((form) => ({
                            ...form,
                            confirmPassword: event.target.value,
                          }))
                        }
                        type="password"
                        value={passwordForm.confirmPassword}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        disabled={
                          !user ||
                          passwordBusy ||
                          !passwordForm.currentPassword ||
                          !passwordForm.newPassword ||
                          !passwordForm.confirmPassword
                        }
                        size="sm"
                        type="submit"
                      >
                        Save password
                      </Button>
                      {passwordError ? (
                        <span className="text-label text-destructive">
                          {passwordError}
                        </span>
                      ) : null}
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent className="p-3" value="integrations">
            <Card
              bordered
              className="overflow-hidden rounded-none border-border bg-background"
            >
              <CardHeader className="min-h-9 border-b border-border px-3 py-0 font-mono text-label uppercase tracking-[0.08em] text-muted-foreground">
                <span className="text-primary">❯</span> X.com
                <span className="ml-auto text-[10px] font-normal tracking-[0.05em]">
                  EXTERNAL SERVICE
                </span>
              </CardHeader>
              <CardContent className="grid gap-3 p-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-ui font-medium">Session cookie</p>
                    <p className="mt-0.5 text-label text-muted-foreground">
                      Used only to resolve metadata for your X.com resources.
                    </p>
                  </div>
                  <span
                    className={
                      xComConfigured
                        ? "shrink-0 border border-primary/45 px-1.5 py-0.5 text-label text-primary"
                        : "shrink-0 border border-border px-1.5 py-0.5 text-label text-muted-foreground"
                    }
                  >
                    {xComConfigured ? "Configured" : "Not configured"}
                  </span>
                </div>
                {integrations?.xCom?.updatedAt ? (
                  <p className="text-label text-muted-foreground">
                    Last updated:{" "}
                    {new Date(integrations.xCom.updatedAt).toLocaleString()}
                  </p>
                ) : null}
                <Textarea
                  aria-label="X.com Cookie"
                  autoComplete="off"
                  disabled={!user || integrationBusy}
                  label="Cookie string"
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                    setCookieString(event.target.value)
                  }
                  placeholder="auth_token=...; ct0=..."
                  rows={4}
                  value={cookieString}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    disabled={!user || integrationBusy || !cookieString.trim()}
                    onClick={() => void saveXComCookie(cookieString)}
                    size="sm"
                    type="button"
                  >
                    Save cookie
                  </Button>
                  <Button
                    disabled={!user || integrationBusy || !xComConfigured}
                    onClick={() => void saveXComCookie("")}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    Clear
                  </Button>
                  {integrationError ? (
                    <span className="text-label text-destructive">
                      {integrationError}
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </section>
      </Tabs>
    </div>
  );
}
