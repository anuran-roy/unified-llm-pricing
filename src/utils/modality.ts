import type { Modality } from "../types.js";

/**
 * Source signals shared across provider scrapers that
 * reveal the modality of a model even when the raw
 * pricing does not label it explicitly.
 */
export interface ModalityModel {
  id: string;
  name?: string;
  type?: string;
  mode?: string;
  architecture?: {
    modality?: string;
    input_modalities?: string[] | null;
    output_modalities?: string[] | null;
  };
}

/**
 * Infer the dominant modality of a model from its
 * metadata (mode/type), its OpenRouter-style architecture
 * string (`text+image->image`), and finally from
 * keywords in the model ID/name.
 *
 * Returns `undefined` when there is no signal, meaning
 * the caller should fall back to "text".
 */
export function inferModelModality(
  model: ModalityModel,
): Modality | undefined {
  const idName =
    `${model.id} ${model.name ?? ""}`;

  /*
   * 1. Explicit type/mode signals.
   */
  if (
    model.type === "Embedding" ||
    model.mode === "embedding"
  ) {
    return "embedding";
  }

  if (
    model.mode ===
      "image_generation" ||
    model.mode === "image_edit"
  ) {
    return "image";
  }

  if (
    model.mode === "video_generation"
  ) {
    return "video";
  }

  if (model.mode === "rerank") {
    return "rerank";
  }

  if (
    model.mode ===
      "audio_transcription" ||
    model.mode === "audio_speech" ||
    model.mode === "text_to_speech"
  ) {
    return "audio";
  }

  /*
   * 2. Architecture output modality
   *    (OpenRouter: "text+image->image").
   *
   * Only tag when the output side is a single,
   * unambiguous modality.
   */
  const arch =
    model.architecture?.modality ??
    "";

  const arrow = arch.indexOf("->");

  const output =
    arrow === -1
      ? ""
      : arch.slice(arrow + 2);

  const kinds = output
    .split("+")
    .map((kind) => kind.trim())
    .filter(Boolean);

  if (kinds.length === 1) {
    switch (kinds[0]) {
      case "embeddings":
        return "embedding";
      case "rerank":
        return "rerank";
      case "image":
        return "image";
      case "video":
        return "video";
      case "audio":
      case "speech":
      case "transcription":
        return "audio";
    }
  }

  /*
   * 3. Architecture output modality
   *    (OrcaRouter: output_modalities: ["video"]).
   */
  const outputs =
    arch.length === 0
      ? model.architecture
          ?.output_modalities
      : undefined;

  if (outputs?.length === 1) {
    switch (outputs[0]) {
      case "embeddings":
        return "embedding";
      case "image":
        return "image";
      case "video":
        return "video";
      case "audio":
      case "speech":
      case "transcription":
        return "audio";
    }
  }

  /*
   * 4. Keyword inference on the model ID/name.
   */
  if (/embed/i.test(idName)) {
    return "embedding";
  }

  if (/rerank/i.test(idName)) {
    return "rerank";
  }

  if (
    /imagen|\bimage\b/i.test(idName)
  ) {
    return "image";
  }

  if (
    /\bsora\b|\bveo\b|kling|video/i.test(
      idName,
    )
  ) {
    return "video";
  }

  if (
    /\blyria\b|tts|transcrib|whisper|audio/i.test(
      idName,
    )
  ) {
    return "audio";
  }

  return undefined;
}