export interface PendingInvitation {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
}

export interface InvitationPreview {
  organizationName: string;
  email: string;
  alreadyRegistered: boolean;
}
