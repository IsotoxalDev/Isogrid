
"use client";

import { useState, type FC, useRef, useEffect } from 'react';
import { CanvasItemData, TodoListItem, BoardSettings } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { nanoid } from 'nanoid';

interface TodoItemProps {
    item: CanvasItemData;
    onUpdate: (item: Partial<CanvasItemData> & { id: string }) => void;
    onDragStart: (sourceListId: string, todo: TodoListItem) => void;
    onDrop: (targetListId: string, targetTodoId?: string) => void;
    settings: BoardSettings;
}

const TodoItem: FC<TodoItemProps> = ({ item, onUpdate, onDragStart, onDrop, settings }) => {
    const [newTodoText, setNewTodoText] = useState('');
    const scrollEndRef = useRef<HTMLDivElement>(null);

    const todos = item.todos || [];
    const MAX_ITEMS_BEFORE_SCROLL = 4;
    const isOverLimit = todos.length > MAX_ITEMS_BEFORE_SCROLL;

    // Auto-scroll to bottom when a new item is added
    useEffect(() => {
        if (scrollEndRef.current) {
            scrollEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [todos.length]);

    const handleAddTodo = () => {
        if (!newTodoText.trim()) return;
        const newTodo: TodoListItem = {
            id: nanoid(),
            text: newTodoText,
            completed: false,
        };
        onUpdate({ id: item.id, todos: [...todos, newTodo] });
        setNewTodoText('');
    };

    const handleDelete = (todoId: string) => {
        onUpdate({ id: item.id, todos: todos.filter(t => t.id !== todoId) });
    };

    const handleToggle = (todoId: string) => {
        const updated = todos.map(t => t.id === todoId ? { ...t, completed: !t.completed } : t);
        onUpdate({ id: item.id, todos: updated });
    };

    const renderRows = () => (
        <div className="flex flex-col gap-1 pr-3 pb-1">
            {todos.length === 0 && (
                <div className="text-xs text-muted-foreground italic py-2 text-center opacity-50">
                    No tasks yet
                </div>
            )}
            {todos.map((todo) => (
                <div 
                    key={todo.id}
                    className="flex items-center space-x-2 py-1.5 group min-h-[36px]"
                    draggable
                    onDragStart={() => onDragStart(item.id, todo)}
                    onDrop={(e) => { e.stopPropagation(); onDrop(item.id, todo.id); }}
                    onDragOver={(e) => e.preventDefault()}
                >
                    <Checkbox
                        checked={todo.completed}
                        onCheckedChange={() => handleToggle(todo.id)}
                        className="border-primary/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary w-4 h-4 rounded-sm"
                    />
                    <span className={cn(
                        "flex-grow text-sm text-foreground truncate select-none cursor-default",
                        todo.completed && "line-through text-muted-foreground transition-colors"
                    )}>
                        {todo.text}
                    </span>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        onClick={() => handleDelete(todo.id)}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>
            ))}
            <div ref={scrollEndRef} />
        </div>
    );

    return (
        <div className="flex flex-col h-fit w-full" data-no-drag="true">
            {/* The Box */}
            <div className="flex flex-col w-full border border-border rounded-xl bg-card/30 p-3 shadow-sm transition-all duration-200">
                
                {/* SCROLL LOGIC:
                    1. If items <= 4: h-auto (grows pixel by pixel).
                    2. If items > 4: h-[160px] (locks height, enabling ScrollArea).
                */}
                <div 
                    className={cn(
                        "w-full transition-all duration-300 ease-in-out",
                        isOverLimit ? "h-[160px]" : "h-auto"
                    )}
                    onWheel={(e) => e.stopPropagation()}
                >
                    {isOverLimit ? (
                        /* Only use ScrollArea when we have a fixed height */
                        <ScrollArea className="h-full w-full">
                            {renderRows()}
                        </ScrollArea>
                    ) : (
                        /* Normal div when growing naturally */
                        <div className="flex flex-col">
                            {renderRows()}
                        </div>
                    )}
                </div>

                {/* INPUT FOOTER:
                   shrink-0 ensures this never gets squashed or overlaid.
                   z-10 ensures it stays on top if layout glitches (though flex should handle it).
                */}
                <div className="shrink-0 flex items-center space-x-2 pt-3 mt-2 border-t border-border z-10 bg-transparent">
                    <Input
                        placeholder="Add item..."
                        value={newTodoText}
                        onChange={(e) => setNewTodoText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                        className="h-8 bg-background/50 border-border text-foreground text-xs focus-visible:ring-primary focus-visible:ring-1 focus-visible:border-transparent"
                    />
                    <Button 
                        onClick={handleAddTodo}
                        size="sm"
                        className="h-8 w-8 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 p-0"
                    >
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default TodoItem;
