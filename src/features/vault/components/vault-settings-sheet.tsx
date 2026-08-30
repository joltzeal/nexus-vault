"use client";

import { Inbox, Shield, Users } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/aicanvas/andromeda/components/Badge";
import type {
  ResourceSubmissionItem,
  Visibility,
} from "@/features/resource/types";
import type { VaultCollaborator, VaultShare } from "../api/vault-settings-api";
import {
  MembersPanel,
  SharePanel,
  SubmissionsPanel,
} from "./vault-settings-panels";

export type SettingsTab = "share" | "members" | "submissions";

export function VaultSettingsSheet({
  open,
  activeTab,
  share,
  collaborators,
  submissions,
  spaces,
  ownerName,
  isBusy,
  isImporting,
  nsfwEnabled,
  collectionEnabled,
  canDeleteVault,
  onOpenChange,
  onTabChange,
  onPasswordChange,
  password,
  onVisibilityChange,
  onSubmitShare,
  onNsfwChange,
  onCollectionChange,
  onRemoveCollaborator,
  onApproveSubmission,
  onRejectSubmission,
  onExport,
  onImport,
  onDelete,
}: {
  open: boolean;
  activeTab: SettingsTab;
  share: VaultShare;
  collaborators: VaultCollaborator[];
  submissions: ResourceSubmissionItem[];
  spaces: Array<{ id: string; name: string }>;
  ownerName: string;
  isBusy: boolean;
  isImporting: boolean;
  nsfwEnabled: boolean;
  collectionEnabled: boolean;
  canDeleteVault: boolean;
  password: string;
  onOpenChange: (open: boolean) => void;
  onTabChange: (tab: SettingsTab) => void;
  onPasswordChange: (value: string) => void;
  onVisibilityChange: (value: Visibility) => void;
  onSubmitShare: () => void;
  onNsfwChange: (value: boolean) => void;
  onCollectionChange: (value: boolean) => void;
  onRemoveCollaborator: (id: string) => void;
  onApproveSubmission: (id: string, spaceId?: string) => void;
  onRejectSubmission: (id: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onDelete: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 border-border bg-card p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[48rem]">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Vault settings</SheetTitle>
          <SheetDescription>
            Manage sharing, collaborators and submissions.
          </SheetDescription>
        </SheetHeader>
        <Tabs
          className="flex min-h-0 flex-1 flex-col gap-0"
          value={activeTab}
          onValueChange={(value) => onTabChange(value as SettingsTab)}
        >
          <TabsList
            className="w-full justify-start rounded-none border-b border-border px-3"
            variant="line"
          >
            <TabsTrigger value="share">
              <Shield data-icon="inline-start" />
              Share
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users data-icon="inline-start" />
              Members
            </TabsTrigger>
            <TabsTrigger value="submissions">
              <Inbox data-icon="inline-start" />
              Submissions
              {submissions.length > 0 ? (
                <Badge className="ml-1" variant="accent">
                  {submissions.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>
          <TabsContent
            className="min-h-0 overflow-y-auto px-4 py-4"
            value="share"
          >
            <SharePanel
              canDeleteVault={canDeleteVault}
              isBusy={isBusy}
              isImporting={isImporting}
              nsfwEnabled={nsfwEnabled}
              onDelete={onDelete}
              onExport={onExport}
              onImport={onImport}
              onNsfwChange={onNsfwChange}
              onPasswordChange={onPasswordChange}
              onSubmit={onSubmitShare}
              onVisibilityChange={onVisibilityChange}
              password={password}
              share={share}
            />
          </TabsContent>
          <TabsContent
            className="min-h-0 overflow-y-auto px-4 py-4"
            value="members"
          >
            <MembersPanel
              isBusy={isBusy}
              items={collaborators}
              onRemove={onRemoveCollaborator}
              ownerName={ownerName}
            />
          </TabsContent>
          <TabsContent
            className="min-h-0 overflow-y-auto px-4 py-4"
            value="submissions"
          >
            <SubmissionsPanel
              collectionEnabled={collectionEnabled}
              isBusy={isBusy}
              items={submissions}
              onApprove={onApproveSubmission}
              onCollectionChange={onCollectionChange}
              onReject={onRejectSubmission}
              spaces={spaces}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
