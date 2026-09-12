export type IUser = {
  id: string;
  organizationId: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: Date;
};
