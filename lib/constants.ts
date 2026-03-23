export const GENERATING_PHRASES = [
  "Adjusting details...",
  "Refining colors...",
  "Applying styles...",
  "Almost there...",
  "Adding depth...",
  "Balancing contrast...",
  "Enhancing lighting...",
  "Fine-tuning layout...",
  "Sharpening edges...",
  "Polishing textures...",
  "Optimizing composition...",
  "Rendering pixels...",
  "Crafting masterpiece...",
  "Infusing creativity...",
  "Bringing vision to life...",
  "Transforming ideas...",
  "Creating magic...",
  "Unleashing imagination...",
  "Blending elements...",
  "Perfecting design...",
  "Capturing essence...",
  "Elevating aesthetics...",
  "Sculpting visuals...",
  "Harmonizing colors...",
  "Weaving details...",
  "Balancing hues...",
  "Refining composition...",
  "Adding final touches...",
  "Bringing it all together...",
  "Creating something amazing...",
  "Making it shine...",
  "Turning vision into reality...",
  "Crafting the perfect thumbnail...",
  "Generating eye-catching visuals...",
  "Designing with style and flair...",
  "Creating thumbnails that pop...",
  "Making your content stand out...",
];
export const CREDIT_UNIT_AMOUNT_CENTS = 20;
export const MAX_FILES = 10;
export const MAX_PROMPT_LENGTH = 1000;
export const DEBOUNCE_MS = 600;
export const VIDEO_TITLE_MAX_LENGTH = 25;
export const MAX_REFERENCE_PX = 512;
export const CREATE_IMAGES = process.env.GENERATE_IMAGES === "true";
export const SAFETY_MODEL = "gemini-3-flash-preview";
export const IMAGE_MODEL = "gemini-3.1-flash-image-preview";
export const THUMBNAIL_SYSTEM_PROMPT = `
Safety check + prompt enrichment (MANDATORY)

Step 1 — Safety check. Reject (blocked: true) if the user's idea contains or implies ANY of the following:
- Nudity, sexual content, or anything suggestive of an adult/+18 nature
- Graphic violence, gore, or gratuitous depictions of injury or death
- Hate speech, discrimination, or symbols associated with extremist groups
- Content that sexualizes or endangers minors in any way
- Realistic depictions of self-harm or suicide
- Illegal activities presented approvingly (drug manufacturing, weapon smuggling, etc.)

Step 2 — Prompt enrichment (only if safe). Rewrite the user's prompt into a vivid, specific YouTube thumbnail description for image generation:
- Default to PHOTOREALISTIC unless the user explicitly requests a cartoon, illustration, or specific art style
- Expand vague ideas into concrete visual direction: describe the scene, lighting, composition, colors, and mood
- Preserve all @channel references, YouTube video URLs, and any specific text the user wants on the thumbnail exactly as written
- Keep the enriched prompt concise (under 400 characters)
- Return it in the prompt field`;
export const CHANNEL_STYLE_INSTRUCTION = `Extract only the visual style from these thumbnails: color palette, typography treatment, layout composition, contrast levels, and overall energy. Do NOT reproduce any people, faces, specific objects, logos, or text from them. Use the style purely as inspiration to create an original thumbnail.`;
export const VIDEO_STYLE_INSTRUCTION = `Extract only the visual style from this video's thumbnail: color palette, typography treatment, layout composition, contrast levels, and overall energy. Do NOT reproduce any people, faces, specific objects, logos, or text from it. Use the style purely as inspiration to create an original thumbnail.`;
