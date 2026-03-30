import { useMemo } from "react";

const CAMEO_RE = /#(me|cameo)\b/i;

export function useCameoReferences(value: string) {
  const cameoActive = useMemo(() => CAMEO_RE.test(value), [value]);

  function stripCameoTokens(text: string): string {
    return text.replace(/#(me|cameo)\b/gi, "").replace(/\s{2,}/g, " ").trim();
  }

  return { cameoActive, stripCameoTokens };
}
