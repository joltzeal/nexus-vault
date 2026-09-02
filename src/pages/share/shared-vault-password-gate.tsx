"use client"

import { useState, type FormEvent } from "react"
import { LockKeyhole, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function SharedVaultPasswordGate({ busy, onSubmit }: { busy: boolean; onSubmit: (password: string) => void }) {
  const [password, setPassword] = useState("")
  function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (password.trim()) onSubmit(password) }
  return (
    <Card className="mx-auto w-full max-w-md border-border bg-card shadow-sm">
      <CardHeader className="gap-3 border-b border-border px-5 py-5">
        <div className="grid size-10 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
          <LockKeyhole aria-hidden="true" className="size-5" />
        </div>
        <div className="grid gap-1">
          <CardTitle className="font-mono text-base">Password required</CardTitle>
          <CardDescription>Enter the password to view this shared vault.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-5 py-5">
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="shared-vault-password">Vault password</FieldLabel>
              <Input
                autoComplete="current-password"
                id="shared-vault-password"
                disabled={busy}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                type="password"
                value={password}
              />
              <FieldDescription>This shared link is protected by a password.</FieldDescription>
            </Field>
          </FieldGroup>
          <Button className="w-full" disabled={busy || !password.trim()} type="submit">
            {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" data-icon="inline-start" /> : <LockKeyhole aria-hidden="true" data-icon="inline-start" />}
            {busy ? "Checking..." : "Unlock vault"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
