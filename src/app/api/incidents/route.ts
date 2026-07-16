import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createIncident, listIncidents } from "@/services/incidents-service";
import type { CreateIncidentInput, IncidentPhoto } from "@/types/incidents";

import { randomUUID } from "node:crypto";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maximumImageSize = 10 * 1024 * 1024;

export async function GET() {
  try {
    return NextResponse.json(await listIncidents());
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Lecture impossible." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const rawData = String(form.get("data") ?? "");
      if (!rawData) return NextResponse.json({ message: "Incident incomplet." }, { status: 400 });
      const input = JSON.parse(rawData) as CreateIncidentInput;
      const files = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
      if (files.some((file) => !allowedImageTypes.has(file.type) || file.size > maximumImageSize)) {
        return NextResponse.json({ message: "Photo invalide. JPG, PNG ou WebP, 10 Mo maximum." }, { status: 400 });
      }
      const supabase = await createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return NextResponse.json({ message: "Authentification requise." }, { status: 401 });

      const uploadedPaths: string[] = [];
      try {
        const photos: IncidentPhoto[] = [];
        for (const file of files) {
          const safeName = file.name.replaceAll(/[^a-zA-Z0-9._-]/g, "-");
          const storagePath = `${input.organization_id}/${auth.user.id}/${randomUUID()}-${safeName}`;
          const upload = await supabase.storage.from("incident-attachments").upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          });
          if (upload.error) throw upload.error;
          uploadedPaths.push(storagePath);
          photos.push({ name: file.name, url: storagePath, size_bytes: file.size, mime_type: file.type });
        }
        return NextResponse.json(await createIncident({ ...input, photos }), { status: 201 });
      } catch (error) {
        if (uploadedPaths.length > 0) await supabase.storage.from("incident-attachments").remove(uploadedPaths);
        throw error;
      }
    }
    const body = await request.json();
    return NextResponse.json(await createIncident(body), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Creation impossible." },
      { status: 500 },
    );
  }
}
