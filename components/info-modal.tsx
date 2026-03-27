import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InfoModal({ open, onOpenChange }: InfoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-xs">
        <DialogHeader>
          <DialogTitle>What is Open Outlier?</DialogTitle>
          <DialogDescription>
            Open-source AI thumbnail generator, it allows you to create stunning
            thumbnails for your content with ease.
            <br />
            <br />
            The code is available on{" "}
            <a
              href="https://github.com/gonzalochale/openoutlier"
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
