
using System;

namespace todo_app.Models
{
    public class Todo
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        
        public string Status { get; set; }

        public string Task { get; set; }

    }
}
