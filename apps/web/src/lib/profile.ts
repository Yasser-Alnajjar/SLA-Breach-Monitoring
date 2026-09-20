import { z } from "zod";

/**
 * The app's CSP only allows `img-src 'self' data: blob:` (no external
 * hosts), so an avatar can't be a pasted URL — it's uploaded, resized
 * client-side, and stored as a `data:` URL in `User.image` directly. This
 * caps the *encoded* string; the client-side resize keeps real uploads far
 * under it.
 */
const MAX_AVATAR_DATA_URL_LENGTH = 500_000;

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  image: z
    .string()
    .max(MAX_AVATAR_DATA_URL_LENGTH, "Image is too large")
    .refine(
      (value) => value === "" || /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value),
      { message: "Avatar must be an uploaded image" },
    )
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
