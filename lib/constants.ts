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
export const PROMPT_PLACEHOLDERS = [
  "Create a thumbnail for my YouTube video with the title...",
  "Design a thumbnail for a video about...",
  "Make a thumbnail for a tutorial on...",
  "Generate a thumbnail for a vlog about...",
  "Create an eye-catching thumbnail for...",
  "Design a thumbnail for a reaction video to...",
  "Make a thumbnail for a gaming video about...",
  "Create a thumbnail for a cooking video showing...",
  "Generate a thumbnail for a tech review of...",
  "Design a thumbnail for a travel video in...",
];
export const CREDIT_PLANS: Record<number, number> = {
  20: 25,
  100: 20,
  500: 15,
};
export const MAX_FILES = 10;
export const MAX_PROMPT_LENGTH = 1000;
export const DEBOUNCE_MS = 600;
export const VIDEO_TITLE_MAX_LENGTH = 25;
export const MAX_REFERENCE_PX = 1080;
export const CREATE_IMAGES = process.env.GENERATE_IMAGES === "true";
export const SAFETY_MODEL = "gemini-3.1-flash-lite-preview";
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
- When the prompt contains @channelHandle mentions, preserve them verbatim in the enriched output — they refer to the channel's visual style (color palette, layout, energy) NOT to the actual creator; do NOT suggest including the creator's face or likeness in the output
- When the prompt references a video title, incorporate thematic or visual elements relevant to that video's topic
- Do NOT include text overlays, words, letters, or typography in the enriched visual description unless the user explicitly asks for text (e.g. "add text saying...", "overlay the title", "write the word..."). The video title is for thematic context only — it is NOT text to render in the image.
- If the instruction requests text to appear in the image, write that text in the same language the user is writing in, unless they explicitly specify a different language.
- Do NOT add people, faces, or human subjects to the enriched description unless the user explicitly asks for them (e.g. "show a person", "include a man", "add a face"). If the user's prompt is about an object, topic, or concept, describe that — no people.
- If the input starts with [Starting image: ...], you are in STARTING IMAGE MODE. The user provided a photo as the main subject. If that photo contains people, they are the subjects — your enriched description must direct the model to use their real faces and appearance exactly as provided, not generate new ones. Describe the scene, mood, and composition around the content of that photo.
- If the input starts with [Previous thumbnail: "..."], you are in EDIT MODE. The bracketed description is what was previously generated. The text after "Edit:" is the user's change instruction. Produce an enriched description of the FINAL RESULT after applying that change — preserving everything from the previous thumbnail that is not explicitly modified.
- Keep the enriched prompt concise (under 400 characters)
- Return it in the prompt field`;
export const CHANNEL_STYLE_INSTRUCTION = `STYLE REFERENCE ONLY — these thumbnails are provided as aesthetic inspiration. You MUST generate 100% original content.

FORBIDDEN (do NOT include in your output):
- The specific person(s) visible in these images, or anyone resembling them
- Their name, face, likeness, or any identifiable features
- Their logos, channel branding, or text from these images
- Any specific object, product, or background scene shown

ALLOWED (extract these abstract properties only):
- Color palette and dominant hue combinations
- Text treatment: font weight, size relative to frame, placement zones
- Compositional layout: where subjects are positioned, use of negative space
- Contrast intensity and lighting style (dark/light, dramatic/flat)
- Overall energy and visual "loudness" of the design`;
export const VIDEO_STYLE_INSTRUCTION = `STYLE REFERENCE ONLY — this thumbnail is provided as aesthetic inspiration. You MUST generate 100% original content.

FORBIDDEN (do NOT include in your output):
- The specific person(s) visible in this image, or anyone resembling them
- Their name, face, likeness, logos, or text from this image
- Any specific object, product, or background scene shown

ALLOWED (extract these abstract properties only):
- Color palette and dominant hue combinations
- Text treatment: font weight, size relative to frame, placement zones
- Compositional layout and use of negative space
- Contrast intensity and lighting style
- Overall energy and visual tone`;
export const REFERENCE_IMAGES_WARNING = `CRITICAL: The reference images below contain real people. Do NOT include those people, their faces, or anyone resembling them in your output. Use reference images for aesthetic style only.`;
export const PHOTOREALISM_PREAMBLE = `Generate a high-quality, PHOTOREALISTIC YouTube thumbnail (16:9). Do NOT produce cartoons, illustrations, anime, or drawings unless the prompt explicitly requests that art style.`;
export const NO_TEXT_RULE = `Do NOT add any text, words, letters, numbers, or typography to the image unless the instruction explicitly requests it.`;
export const DEFAULT_POSTAMBLE = `The result should look like a professional YouTube thumbnail: bold composition, high contrast, strong visual hierarchy, and immediately eye-catching. All people and faces must be original — do not copy or reproduce any person from the reference images. Do NOT add people, faces, or human subjects unless the instruction explicitly includes them. ${NO_TEXT_RULE}`;
