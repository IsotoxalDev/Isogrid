import React, { useState } from 'react';
import { Board } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Home, Folder } from 'lucide-react';

interface MoveToBoardDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onMove: (targetBoardId: string) => void;
    boards: Board[];
    currentBoardId: string | null;
}

export default function MoveToBoardDialog({
    isOpen,
    onClose,
    onMove,
    boards,
    currentBoardId,
}: MoveToBoardDialogProps) {
    const [selectedBoardId, setSelectedBoardId] = useState<string>(currentBoardId || 'root');

    if (!isOpen) return null;

    const validBoards = [
        { id: 'root', name: 'Home' },
        ...boards.filter(b => b.id !== currentBoardId) // Exclude current board (already filtered in parent? nice to be safe)
    ];

    // Filter out the current board if it's in the list (to avoid moving to self)
    // Actually, 'root' is 'Home'. If currentBoardId is null, moving to root is invalid.
    // If currentBoardId is 'root', moving to root is invalid.
    // So we filter out the board with id === (currentBoardId || 'root')

    const moveTargets = validBoards.filter(b => b.id !== (currentBoardId || 'root'));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Card className="w-[400px] max-h-[80vh] flex flex-col shadow-xl">
                <CardHeader>
                    <CardTitle>Move Item to Board</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                    <ScrollArea className="h-[300px] px-6">
                        <RadioGroup
                            value={selectedBoardId}
                            onValueChange={setSelectedBoardId}
                            className="gap-2 py-4"
                        >
                            {moveTargets.length === 0 && (
                                <div className="text-center text-muted-foreground py-8">
                                    No other boards available.
                                </div>
                            )}

                            {moveTargets.map((board) => (
                                <div key={board.id} className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-accent cursor-pointer" onClick={() => setSelectedBoardId(board.id)}>
                                    <RadioGroupItem value={board.id} id={board.id} />
                                    <Label htmlFor={board.id} className="flex items-center gap-2 cursor-pointer w-full">
                                        {board.id === 'root' ? <Home size={16} /> : <Folder size={16} />}
                                        <span className="font-medium">{board.name}</span>
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                    </ScrollArea>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={() => {
                            onMove(selectedBoardId);
                            onClose();
                        }}
                        disabled={!selectedBoardId || selectedBoardId === (currentBoardId || 'root')}
                    >
                        Move
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
