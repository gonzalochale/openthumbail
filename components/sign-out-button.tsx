"use client";

import { LogOut } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  return (
    <DropdownMenuItem
      variant="destructive"
      onClick={() => authClient.signOut()}
    >
      <LogOut />
      Sign out
    </DropdownMenuItem>
  );
}
