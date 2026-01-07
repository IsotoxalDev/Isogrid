"use client";

import { useState, type FC, useRef, useEffect } from 'react';
import { CanvasItemData, TodoListItem } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TodoItemProps {
    item: CanvasItemData;
    onUpdate: (item: Partial<CanvasItemData> & { id: string }) => void;
    onDragStart: (sourceListId: string, todo: TodoListItem) => void;
    onDrop: (targetListId: string, targetTodoId: string) => void;
}

const TodoItem: FC<TodoItemProps> = ({ item, onUpdate, onDragStart, onDrop }) => {
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
            id: `todo-${Date.now()}`,
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
                <div className="text-xs text-zinc-500 italic py-2 text-center opacity-50">
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
                        className="border-lime-400/50 data-[state=checked]:bg-lime-400 data-[state=checked]:border-lime-400 w-4 h-4 rounded-sm"
                    />
                    <span className={cn(
                        "flex-grow text-sm text-zinc-200 truncate select-none cursor-default",
                        todo.completed && "line-through text-zinc-500 transition-colors"
                    )}>
                        {todo.text}
                    </span>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 hover:bg-zinc-800/50 transition-all"
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
            <div className="flex flex-col w-full border border-zinc-800 rounded-xl bg-zinc-900/30 p-3 shadow-sm transition-all duration-200">
                
                {/* SCROLL LOGIC:
                    1. If items <= 4: h-auto (grows pixel by pixel).
                    2. If items > 4: h-[160px] (locks height, enabling ScrollArea).
                */}
                <div className={cn(
                    "w-full transition-all duration-300 ease-in-out",
                    isOverLimit ? "h-[160px]" : "h-auto"
                )}>
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
                <div className="shrink-0 flex items-center space-x-2 pt-3 mt-2 border-t border-zinc-800 z-10 bg-transparent">
                    <Input
                        placeholder="Add item..."
                        value={newTodoText}
                        onChange={(e) => setNewTodoText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                        className="h-8 bg-zinc-950/50 border-zinc-800 text-zinc-300 text-xs focus-visible:ring-lime-400 focus-visible:ring-1 focus-visible:border-transparent"
                    />
                    <Button 
                        onClick={handleAddTodo}
                        size="sm"
                        className="h-8 w-8 bg-lime-400 hover:bg-lime-500 text-zinc-950 shrink-0 p-0"
                    >
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default TodoItem;