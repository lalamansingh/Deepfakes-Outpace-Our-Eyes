import { requireStaff } from "@/lib/server/auth";
import { HttpError, json, route } from "@/lib/server/http";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { MAX_UPLOAD_BYTES, storeUpload } from "@/lib/server/storage";

export const POST = route(async (req) => {
  const staff = await requireStaff(req, ["admin"]);
  rateLimit(`upload:${staff.id}`, ...LIMITS.upload);
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) throw new HttpError("payload_too_large", "File is too large");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError("validation_error", "Send the file as multipart/form-data");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new HttpError("validation_error", "Choose a file to upload");
  return json(await storeUpload(file), { status: 201 });
});
