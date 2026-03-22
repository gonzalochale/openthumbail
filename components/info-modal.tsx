import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

export function InfoModal() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-lg">
            <Info />
          </Button>
        }
      />
      <DialogContent showCloseButton={false} className="max-w-xs">
        <DialogHeader>
          <DialogTitle>What is OpenThumbnail?</DialogTitle>
          <DialogDescription>
            Open-source AI thumbnail generator, it allows you to create stunning
            thumbnails for your content with ease.
            <br />
            <br />
            The code is available on{" "}
            <a
              href="https://github.com/gonzalochale/openthumbnail"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            .
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
