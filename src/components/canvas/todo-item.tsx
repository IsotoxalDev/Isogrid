
"use client";

import { useState, type FC, KeyboardEvent, DragEvent, useRef } from 'react';
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
    const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const dragItem = useRef<string | null>(null);
    const dragOverItem = useRef<string | null>(null);

    const MAX_ITEMS_BEFORE_SCROLL = 4;

    const handleAddTodo = () => {
        if (newTodoText.trim() === '') return;
        const newTodo: TodoListItem = {
            id: `todo-item-${Date.now()}`,
            text: newTodoText,
            completed: false,
        };
        onUpdate({ id: item.id, todos: [...(item.todos || []), newTodo] });
        setNewTodoText('');
    };

    const handleAddKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleAddTodo();
        }
    };

    const handleToggleTodo = (todoId: string) => {
        const updatedTodos = (item.todos || []).map(todo =>
            todo.id === todoId ? { ...todo, completed: !todo.completed } : todo
        );
        onUpdate({ id: item.id, todos: updatedTodos });
    };

    const handleDeleteTodo = (todoId: string) => {
        const updatedTodos = (item.todos || []).filter(todo => todo.id !== todoId);
        onUpdate({ id: item.id, todos: updatedTodos });
    };

    const handleDoubleClick = (todo: TodoListItem) => {
        setEditingTodoId(todo.id);
        setEditingText(todo.text);
    };

    const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>, todoId: string) => {
        if (e.key === 'Enter') {
            handleUpdateTodoText(todoId);
        }
        if (e.key === 'Escape') {
            setEditingTodoId(null);
        }
    };

    const handleUpdateTodoText = (todoId: string) => {
        const updatedTodos = (item.todos || []).map(todo =>
            todo.id === todoId ? { ...todo, text: editingText } : todo
        );
        onUpdate({ id: item.id, todos: updatedTodos });
        setEditingTodoId(null);
        setEditingText('');
    };
    
    const handleDragStart = (e: DragEvent<HTMLDivElement>, todo: TodoListItem) => {
        onDragStart(item.id, todo);
        dragItem.current = todo.id;
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnter = (e: DragEvent<HTMLDivElement>, todoId: string) => {
        e.preventDefault();
        dragOverItem.current = todoId;
    };

    const handleDragEnd = () => {
        if (!dragItem.current || !dragOverItem.current || dragItem.current === dragOverItem.current) {
            dragItem.current = null;
            dragOverItem.current = null;
            return;
        }
        
        const currentTodos = [...(item.todos || [])];
        const dragItemIndex = currentTodos.findIndex(t => t.id === dragItem.current);
        const dragOverItemIndex = currentTodos.findIndex(t => t.id === dragOverItem.current);
        
        // This is for re-ordering within the same list.
        // The cross-list drop is handled at the page level.
        const [reorderedItem] = currentTodos.splice(dragItemIndex, 1);
        currentTodos.splice(dragOverItemIndex, 0, reorderedItem);

        onUpdate({ id: item.id, todos: currentTodos });

        dragItem.current = null;
        dragOverItem.current = null;
    };
    
    const handleDrop = (e: DragEvent<HTMLDivElement>, targetTodoId: string) => {
        e.stopPropagation();
        onDrop(item.id, targetTodoId);
    }


    const todos = item.todos || [];
    const useScroll = todos.length > MAX_ITEMS_BEFORE_SCROLL;

    const renderTodoList = () => (
        todos.map(todo => (
            <div 
                key={todo.id}
                className="flex items-center space-x-2 py-1 group cursor-grab active:cursor-grabbing" 
                data-no-drag="true"
                draggable
                onDragStart={(e) => handleDragStart(e, todo)}
                onDragEnter={(e) => handleDragEnter(e, todo.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, todo.id)}
            >
                <Checkbox
                    id={todo.id}
                    checked={todo.completed}
                    onCheckedChange={() => handleToggleTodo(todo.id)}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary-foreground"
                />
                {editingTodoId === todo.id ? (
                    <Input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, todo.id)}
                        onBlur={() => handleUpdateTodoText(todo.id)}
                        autoFocus
                        className="h-7 text-sm"
                    />
                ) : (
                    <label 
                        htmlFor={todo.id} 
                        className={cn("flex-grow text-sm", todo.completed && "line-through text-muted-foreground")}
                        onDoubleClick={() => handleDoubleClick(todo)}
                    >
                        {todo.text}
                    </label>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteTodo(todo.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
            </div>
        ))
    );

    return (
        <div className="h-full flex flex-col" data-no-drag="true">
            <div className="flex-grow">
                {useScroll ? (
                    <ScrollArea className="h-[120px] pr-3">
                        {renderTodoList()}
                    </ScrollArea>
                ) : (
                    <div>
                        {renderTodoList()}
                    </div>
                )}
            </div>
            <div className="flex items-center space-x-2 pt-2 mt-auto border-t">
                <Input
                    type="text"
                    placeholder="Add a new item..."
                    value={newTodoText}
                    onChange={(e) => setNewTodoText(e.target.value)}
                    onKeyDown={handleAddKeyDown}
                    className="h-8 text-sm"
                />
                <Button size="icon" className="h-8 w-8" onClick={handleAddTodo}>
                    <Plus className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}

export default TodoItem;
