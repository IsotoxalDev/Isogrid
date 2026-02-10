import React, { useState } from 'react';
import { Board } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Home, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MoveToBoardDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onMove: (targetBoardId: string) => void;
    boards: Board[];
    currentBoardId: string | null;
    movingItemId: string | null;
}

export default function MoveToBoardDialog({
    isOpen,
    onClose,
    onMove,
    boards,
    currentBoardId,
    movingItemId,
}: MoveToBoardDialogProps) {
    const [selectedBoardId, setSelectedBoardId] = useState<string>(currentBoardId || 'root');

    if (!isOpen) return null;

    // Build the tree structure
    type BoardNode = Board & { children: BoardNode[] };
    const buildTree = (parentId: string | null): BoardNode[] => {
        return boards
            .filter(b => b.parentId === parentId)
            .map(b => ({ ...b, children: buildTree(b.id) }));
    };

    const homeNode: BoardNode = {
        id: 'root',
        name: 'Home',
        children: buildTree(null)
    };

    // Helper to find all descendant IDs
    const getAllDescendantIds = (nodes: BoardNode[]): string[] => {
        let ids: string[] = [];
        for (const node of nodes) {
            ids.push(node.id);
            if (node.children.length > 0) {
                ids = [...ids, ...getAllDescendantIds(node.children)];
            }
        }
        return ids;
    };

    // Find the subtree starting from the moving item to disable it and all its children
    const findSubtree = (node: BoardNode, targetId: string): BoardNode[] | null => {
        if (node.id === targetId) return node.children;
        for (const child of node.children) {
            const found = findSubtree(child, targetId);
            if (found) return found;
        }
        return null;
    };

    const movingItemDescendants = movingItemId ? getAllDescendantIds(findSubtree(homeNode, movingItemId) || []) : [];
    const fullDisabledList = movingItemId ? [movingItemId, ...movingItemDescendants] : [];

    const renderNode = (node: BoardNode, depth: number = 0) => {
        const isCurrentBoard = node.id === (currentBoardId || 'root');
        const isMovingItem = node.id === movingItemId;
        const isDescendant = fullDisabledList.includes(node.id);
        const isDisabled = isCurrentBoard || isMovingItem || isDescendant;

        return (
            <React.Fragment key={node.id}>
                <div
                    className={cn(
                        "flex items-center space-x-2 rounded-lg border p-3 transition-colors mb-1",
                        isDisabled ? "opacity-50 cursor-not-allowed bg-muted" : "hover:bg-accent cursor-pointer"
                    )}
                    style={{ marginLeft: `${depth * 20}px` }}
                    onClick={() => !isDisabled && setSelectedBoardId(node.id)}
                >
                    <RadioGroupItem
                        value={node.id}
                        id={node.id}
                        disabled={isDisabled}
                    />
                    <Label
                        htmlFor={node.id}
                        className={cn(
                            "flex items-center gap-2 w-full",
                            isDisabled ? "cursor-not-allowed" : "cursor-pointer"
                        )}
                    >
                        {node.id === 'root' ? <Home size={16} /> : <Folder size={16} />}
                        <span className="font-medium truncate max-w-[200px]">{node.name}</span>
                        {isCurrentBoard && <span className="text-[10px] text-muted-foreground ml-auto uppercase tracking-tighter">(Current)</span>}
                        {isMovingItem && <span className="text-[10px] text-muted-foreground ml-auto uppercase tracking-tighter">(Self)</span>}
                        {!isMovingItem && isDescendant && <span className="text-[10px] text-muted-foreground ml-auto uppercase tracking-tighter">(Descendant)</span>}
                    </Label>
                </div>
                {node.children.map(child => renderNode(child, depth + 1))}
            </React.Fragment>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-[450px] max-h-[90vh] flex flex-col shadow-2xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Folder className="w-5 h-5" />
                        Move to Board
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                    <ScrollArea className="h-[400px] px-6 py-4">
                        <RadioGroup
                            value={selectedBoardId}
                            onValueChange={setSelectedBoardId}
                            className="flex flex-col"
                        >
                            {renderNode(homeNode)}
                        </RadioGroup>
                    </ScrollArea>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 pt-4 border-t p-6">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={() => {
                            onMove(selectedBoardId);
                            onClose();
                        }}
                        disabled={!selectedBoardId || selectedBoardId === (currentBoardId || 'root') || fullDisabledList.includes(selectedBoardId)}
                    >
                        Move
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
