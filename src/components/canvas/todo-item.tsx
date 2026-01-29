
"use client";

import React, { useState, type FC, useRef, useEffect } from 'react';
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
    const [draggedOverTodoId, setDraggedOverTodoId] = useState<string | null>(null);
    const [draggingTodoId, setDraggingTodoId] = useState<string | null>(null);
    const [todoHeights, setTodoHeights] = useState<Record<string, number>>({});
    const scrollEndRef = useRef<HTMLDivElement>(null);
    const todoRefs = useRef<Record<string, HTMLDivElement | null>>({});
    // Ref to access current todos in event listeners without re-binding
    const todosRef = useRef(item.todos || []);

    // Update todosRef whenever todos changes
    useEffect(() => {
        todosRef.current = item.todos || [];
    }, [item.todos]);

    // Auto-scroll refs
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollSpeed = useRef(0);
    const animationFrameId = useRef<number | null>(null);

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

    // Auto-scroll logic
    const handleScroll = () => {
        if (scrollSpeed.current !== 0 && containerRef.current) {
            const viewport = containerRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
            if (viewport) {
                viewport.scrollTop += scrollSpeed.current;
                animationFrameId.current = requestAnimationFrame(handleScroll);
            }
        } else {
            animationFrameId.current = null;
        }
    };

    // Global drag over handler for auto-scroll
    useEffect(() => {
        if (!draggingTodoId) {
            scrollSpeed.current = 0;
            return;
        }

        const handleWindowDragOver = (e: DragEvent) => {
            if (!containerRef.current) return;

            const rect = containerRef.current.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const height = rect.height;
            const threshold = 50;
            const maxSpeed = 15; // Increased max speed slightly

            if (y < threshold) {
                // Scroll up - faster as you go further up (negative y)
                // If y is negative (above container), speed increases
                scrollSpeed.current = -maxSpeed * (1 - y / threshold);
                // Clamp max speed to avoid crazy fast scrolling when way above
                scrollSpeed.current = Math.max(scrollSpeed.current, -maxSpeed * 3);

                if (!animationFrameId.current) {
                    handleScroll();
                }
            } else if (y > height - threshold) {
                // Scroll down - faster as you go further down
                // If y > height (below container), speed increases
                scrollSpeed.current = maxSpeed * ((y - (height - threshold)) / threshold);
                // Clamp max speed
                scrollSpeed.current = Math.min(scrollSpeed.current, maxSpeed * 3);

                if (!animationFrameId.current) {
                    handleScroll();
                }
            } else {
                scrollSpeed.current = 0;
            }

            // Calculate placeholder position based on Y coordinate
            // This ensures placeholder moves even when not hovering directly over an item
            const relativeY = e.clientY - rect.top + (containerRef.current.querySelector('[data-radix-scroll-area-viewport]')?.scrollTop || 0);

            // Find the todo item that is closest to the mouse Y position
            let closestTodoId: string | null = null;
            let minDistance = Infinity;

            // We need to access the current todos list here. 
            // Since this effect depends on draggingTodoId, we can access 'todos' from the component scope
            // providing we add it to the dependency array or use a ref. 
            // Using a ref for todos is safer to avoid re-binding the event listener constantly.

            // However, for simplicity in this effect, we can try to find the element by DOM query if needed, 
            // or better, just iterate through the known refs since we have todoRefs.

            Object.entries(todoRefs.current).forEach(([id, el]) => {
                if (el && id !== draggingTodoId) {
                    const elRect = el.getBoundingClientRect();
                    // Calculate center of the element relative to the container top (including scroll)
                    // Actually, simpler to just use client coordinates for comparison since we have e.clientY
                    const elCenterY = elRect.top + elRect.height / 2;
                    const distance = Math.abs(e.clientY - elCenterY);

                    if (distance < minDistance) {
                        minDistance = distance;
                        closestTodoId = id;
                    }
                }
            });

            // Check if we are below the last visible item FIRST
            let isBelowLast = false;
            const visibleTodos = todosRef.current.filter(t => t.id !== draggingTodoId);

            if (visibleTodos.length > 0) {
                const lastTodo = visibleTodos[visibleTodos.length - 1];
                const lastEl = todoRefs.current[lastTodo.id];
                if (lastEl) {
                    const rect = lastEl.getBoundingClientRect();
                    // If we are below the bottom of the last item, show placeholder at end
                    if (e.clientY > rect.bottom) {
                        isBelowLast = true;
                    }
                }
            } else if (todosRef.current.length === 1 && draggingTodoId) {
                // If the only item is being dragged, we treat it as being at the end
                isBelowLast = true;
            }

            if (isBelowLast) {
                setDraggedOverTodoId('placeholder-end');
            } else if (closestTodoId) {
                setDraggedOverTodoId(closestTodoId);
            }
        };

        window.addEventListener('dragover', handleWindowDragOver);

        return () => {
            window.removeEventListener('dragover', handleWindowDragOver);
            scrollSpeed.current = 0;
        };
    }, [draggingTodoId]); // Removed todos from dependency array, using ref instead

    useEffect(() => {
        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, []);

    const renderRows = () => {

        return (
            <div className="flex flex-col gap-1 pr-3 pb-1">
                {todos.length === 0 && (
                    <div className="text-xs text-muted-foreground italic py-2 text-center opacity-50">
                        No tasks yet
                    </div>
                )}
                {todos.map((todo) => {
                    const isDragging = draggingTodoId === todo.id;
                    const placeholderHeight = draggingTodoId ? todoHeights[draggingTodoId] || 40 : 40;

                    return (
                        <React.Fragment key={todo.id}>
                            {/* Placeholder shown when dragging over this todo */}
                            {draggedOverTodoId === todo.id && (
                                <div
                                    className="bg-primary/20 border-2 border-dashed border-primary rounded mx-2 my-1"
                                    style={{ height: `${placeholderHeight}px` }}
                                />
                            )}

                            <div
                                ref={(el) => {
                                    todoRefs.current[todo.id] = el;
                                    if (el && !todoHeights[todo.id]) {
                                        const height = el.offsetHeight;
                                        if (height > 0) {
                                            setTodoHeights(prev => ({ ...prev, [todo.id]: height }));
                                        }
                                    }
                                }}
                                className={cn(
                                    "flex items-start space-x-2 py-1.5 group min-h-[36px]",
                                    isDragging && "absolute opacity-0 w-0 h-0 min-h-0 p-0 m-0 border-0 pointer-events-none"
                                )}
                                draggable
                                onDragStart={(e) => {
                                    onDragStart(item.id, todo);
                                    // Use setTimeout to ensure the browser captures the drag image 
                                    // of the visible element before we hide it
                                    setTimeout(() => {
                                        setDraggingTodoId(todo.id);
                                    }, 0);
                                }}
                                onDragEnd={(e) => {
                                    setDraggingTodoId(null);
                                    setDraggedOverTodoId(null);
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Only update if different to reduce re-renders
                                    if (draggedOverTodoId !== todo.id) {
                                        setDraggedOverTodoId(todo.id);
                                    }
                                }}

                                onDrop={(e) => {
                                    e.stopPropagation();
                                    onDrop(item.id, todo.id);
                                    setDraggedOverTodoId(null);
                                    setDraggingTodoId(null);
                                }}
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
                        </React.Fragment>
                    );
                })}

                {/* Placeholder at the end of the list */}
                {draggedOverTodoId === 'placeholder-end' && (
                    <div
                        className="bg-primary/20 border-2 border-dashed border-primary rounded mx-2 my-1"
                        style={{ height: `${draggingTodoId ? todoHeights[draggingTodoId] || 40 : 40}px` }}
                    />
                )}

                <div ref={scrollEndRef} />
            </div>
        );
    };

    return (
        <div
            className="flex flex-col h-full w-full"
            data-no-drag="true"
        >
            {/* Scrollable content area - always uses ScrollArea */}
            <div
                className="flex-1 overflow-hidden"
                ref={containerRef}
                onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggingTodoId) {
                        if (draggedOverTodoId === 'placeholder-end') {
                            onDrop(item.id, undefined); // Drop at the end
                        } else if (draggedOverTodoId) {
                            onDrop(item.id, draggedOverTodoId);
                        }
                        setDraggedOverTodoId(null);
                        setDraggingTodoId(null);
                    }
                }}
                onDragOver={(e) => e.preventDefault()}
            >
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
