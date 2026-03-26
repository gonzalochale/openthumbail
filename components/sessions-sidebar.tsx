import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Plus } from "lucide-react";
import { Button } from "./ui/button";

export function SessionsSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        <h1 className="h-8 px-2.5 text-xs/relaxed font-medium whitespace-nowrap select-none flex items-center">
          Sessions
        </h1>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <Button variant="outline" size="lg" className="w-full">
          <Plus />
          New Session
        </Button>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
