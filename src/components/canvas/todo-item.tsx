
"use client";

import { useState, type FC, KeyboardEvent } from 'react';
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
}

const TodoItem: FC<TodoItemProps> = ({ item, onUpdate }) => {
    const [newTodoText, setNewTodoText] = useState('');
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

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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
    }

    const todos = item.todos || [];
    const useScroll = todos.length > MAX_ITEMS_BEFORE_SCROLL;

    const renderTodoList = () => (
        todos.map(todo => (
            <div key={todo.id} className="flex items-center space-x-2 py-1 group" data-no-drag="true">
                <Checkbox
                    id={todo.id}
                    checked={todo.completed}
                    onCheckedChange={() => handleToggleTodo(todo.id)}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary-foreground"
                />
                <label htmlFor={todo.id} className={cn("flex-grow text-sm", todo.completed && "line-through text-muted-foreground")}>{todo.text}</label>
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
                    onKeyDown={handleKeyDown}
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
