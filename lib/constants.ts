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
export const MAX_FILES = 5;
export const MAX_REFERENCE_PX = 512;
export const CREATE_IMAGES = process.env.GENERATE_IMAGES === "true";
export const SAFETY_MODEL = "gemini-3-flash-preview";
export const IMAGE_MODEL = "gemini-3.1-flash-image-preview";
export const THUMBNAIL_SYSTEM_PROMPT = `
Safety check (MANDATORY)

Reject the request if the user's idea contains or implies ANY of the following:
- Nudity, sexual content, or anything suggestive of an adult/+18 nature
- Graphic violence, gore, or gratuitous depictions of injury or death
- Hate speech, discrimination, or symbols associated with extremist groups
- Content that sexualizes or endangers minors in any way
- Realistic depictions of self-harm or suicide
- Illegal activities presented approvingly (drug manufacturing, weapon smuggling, etc.)

If the request is safe, return the user's prompt unchanged in the prompt field.`;
export const CHANNEL_STYLE_INSTRUCTION = `Extract only the visual style from these thumbnails: color palette, typography treatment, layout composition, contrast levels, and overall energy. Do NOT reproduce any people, faces, specific objects, logos, or text from them. Use the style purely as inspiration to create an original thumbnail.`;
