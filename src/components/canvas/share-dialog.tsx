"use client";

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, X, Share2 } from 'lucide-react';
import { BoardRole } from '@/lib/types';
import { lookupUserByEmail, getUserDirectoryEntry, setCollaboratorRole, removeCollaborator } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  ownerId: string;
  collaborators: Record<string, BoardRole>;
  isOwner: boolean;
  currentUserEmail?: string | null;
  onCollaboratorsChange: (updater: (prev: Record<string, BoardRole>) => Record<string, BoardRole>) => void;
}

type CollaboratorRow = { uid: string; role: BoardRole | 'owner'; email: string; displayName: string };

export default function ShareDialog({ isOpen, onClose, boardId, ownerId, collaborators, isOwner, currentUserEmail, onCollaboratorsChange }: ShareDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<BoardRole>('editor');
  const [isInviting, setIsInviting] = useState(false);
  const [rows, setRows] = useState<CollaboratorRow[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoadingRows(true);

    (async () => {
      const uids = [ownerId, ...Object.keys(collaborators)];
      const resolved = await Promise.all(uids.map(async (uid) => {
        const entry = await getUserDirectoryEntry(uid);
        return {
          uid,
          role: uid === ownerId ? 'owner' as const : collaborators[uid],
          email: entry?.email ?? '',
          displayName: entry?.displayName ?? 'Unknown user',
        };
      }));
      if (!cancelled) setRows(resolved);
    })().finally(() => { if (!cancelled) setIsLoadingRows(false); });

    return () => { cancelled = true; };
  }, [isOpen, ownerId, collaborators]);

  const handleInvite = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;

    if (trimmed.toLowerCase() === currentUserEmail?.toLowerCase()) {
      toast({ variant: 'destructive', title: "You already have access" });
      return;
    }

    setIsInviting(true);
    try {
      const found = await lookupUserByEmail(trimmed);
      if (!found) {
        toast({ variant: 'destructive', title: 'No Isogrid user found with that email' });
        return;
      }
      if (found.uid === ownerId) {
        toast({ variant: 'destructive', title: "That user already owns this board" });
        return;
      }
      await setCollaboratorRole(boardId, found.uid, role);
      setRows(prev => {
        const withoutExisting = prev.filter(r => r.uid !== found.uid);
        return [...withoutExisting, { uid: found.uid, role, email: found.email, displayName: found.displayName }];
      });
      onCollaboratorsChange(prev => ({ ...prev, [found.uid]: role }));
      setEmail('');
      toast({ title: `Invited ${found.displayName || found.email} as ${role}` });
    } catch (error) {
      console.error('Error inviting collaborator:', error);
      toast({ variant: 'destructive', title: 'Could not send invite' });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (uid: string, newRole: BoardRole) => {
    setRows(prev => prev.map(r => r.uid === uid ? { ...r, role: newRole } : r));
    onCollaboratorsChange(prev => ({ ...prev, [uid]: newRole }));
    try {
      await setCollaboratorRole(boardId, uid, newRole);
    } catch (error) {
      console.error('Error changing role:', error);
      toast({ variant: 'destructive', title: 'Could not update role' });
    }
  };

  const handleRemove = async (uid: string) => {
    setRows(prev => prev.filter(r => r.uid !== uid));
    onCollaboratorsChange(prev => {
      const next = { ...prev };
      delete next[uid];
      return next;
    });
    try {
      await removeCollaborator(boardId, uid);
    } catch (error) {
      console.error('Error removing collaborator:', error);
      toast({ variant: 'destructive', title: 'Could not remove access' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-4 h-4" /> Share board
          </DialogTitle>
          <DialogDescription>
            Invite other Isogrid users to view or edit this board.
          </DialogDescription>
        </DialogHeader>

        {isOwner && (
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
              disabled={isInviting}
            />
            <div className="flex rounded-md border overflow-hidden shrink-0">
              {(['viewer', 'editor'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "px-3 text-sm capitalize",
                    role === r ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-accent"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <Button onClick={handleInvite} disabled={isInviting || !email.trim()}>
              {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Invite'}
            </Button>
          </div>
        )}

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {isLoadingRows ? (
            <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : (
            rows.map(row => (
              <div key={row.uid} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{row.displayName}</div>
                  <div className="text-xs text-muted-foreground truncate">{row.email}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {row.role === 'owner' ? (
                    <span className="text-xs text-muted-foreground uppercase tracking-tighter px-2">Owner</span>
                  ) : isOwner ? (
                    <>
                      <div className="flex rounded-md border overflow-hidden">
                        {(['viewer', 'editor'] as const).map(r => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => handleRoleChange(row.uid, r)}
                            className={cn(
                              "px-2 py-1 text-xs capitalize",
                              row.role === r ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-accent"
                            )}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemove(row.uid)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground uppercase tracking-tighter px-2">{row.role}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
