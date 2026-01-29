
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
    const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
    const [editingTodoText, setEditingTodoText] = useState('');
    const scrollEndRef = useRef<HTMLDivElement>(null);

    const todos = item.todos || [];

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

    const handleStartEdit = (todo: TodoListItem) => {
        setEditingTodoId(todo.id);
        setEditingTodoText(todo.text);
    };

    const handleSaveEdit = (todoId: string) => {
        if (editingTodoText.trim()) {
            const updated = todos.map(t => t.id === todoId ? { ...t, text: editingTodoText } : t);
            onUpdate({ id: item.id, todos: updated });
        }
        setEditingTodoId(null);
        setEditingTodoText('');
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
                    className="flex items-start space-x-2 py-1.5 group min-h-[36px]"
                    draggable
                    onDragStart={() => onDragStart(item.id, todo)}
                    onDrop={(e) => { e.stopPropagation(); onDrop(item.id, todo.id); }}
                    onDragOver={(e) => e.preventDefault()}
                >
                    <Checkbox
                        checked={todo.completed}
                        onCheckedChange={() => handleToggle(todo.id)}
                        className="border-primary/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary w-4 h-4 rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0 mt-0.5 shrink-0"
                    />
                    {editingTodoId === todo.id ? (
                        <Input
                            value={editingTodoText}
                            onChange={(e) => setEditingTodoText(e.target.value)}
                            onBlur={() => handleSaveEdit(todo.id)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSaveEdit(todo.id);
                                } else if (e.key === 'Escape') {
                                    setEditingTodoId(null);
                                    setEditingTodoText('');
                                }
                            }}
                            autoFocus
                            className="flex-grow h-7 text-sm bg-background/50 border-border"
                        />
                    ) : (
                        <span
                            className={cn(
                                "flex-grow text-sm text-foreground whitespace-normal break-all select-none cursor-pointer",
                                todo.completed && "line-through text-muted-foreground transition-colors"
                            )}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(todo);
                            }}
                        >
                            {todo.text}
                        </span>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
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
        <div
            className="flex flex-col h-full w-full"
            data-no-drag="true"
        >
            {/* Scrollable content area - always uses ScrollArea */}
            <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full w-full">
                    {renderRows()}
                </ScrollArea>
            </div>

            {/* INPUT FOOTER */}
            <div className="shrink-0 flex items-center space-x-2 pt-3 mt-2 border-t border-border">
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
    );
}

export default TodoItem;
