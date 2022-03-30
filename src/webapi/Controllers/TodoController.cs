﻿using System;
using System.Collections.Generic;
using Microsoft.AspNetCore.Mvc;
using todo_app.Models;
using Newtonsoft.Json;
using Microsoft.Extensions.Options;
using Serilog;

namespace todo_app.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TodoController : ControllerBase
    {
        private TodoContext _todoContext;
        IOptions<Parameters> _options;

        ILogger logger;

        public TodoController(IOptions<Parameters> options)
        {
            Console.WriteLine("Todo Controller Start!");
            _options = options;            
            _todoContext = new TodoContext(options);

            logger = new LoggerConfiguration().WriteTo
                                              .Console()
                                              .Enrich
                                              .FromLogContext()
                                              .CreateLogger();
        }

        // GET: api/hire-me
        [HttpGet("hire-me")]
        public bool HireMe() => true;

        // GET: api/todo/5
        [HttpGet("{id}")]
        public List<Todo> Get(int id) => _todoContext.GetAllTodos();

        // GET: api/todo
        [HttpGet]
        public List<Todo> Get()
        {
            logger.Information($"{nameof(Get)} invoked");
            return _todoContext.GetAllTodos();
        }

        // POST api/values
        [HttpPost]
        public void Post([FromBody]Todo todoVal)
        {
            logger.Information($"Entering todo POST - " + JsonConvert.SerializeObject(todoVal, Formatting.Indented));

            if (todoVal != null && !string.IsNullOrEmpty(todoVal.Status) &&
                    !string.IsNullOrEmpty(todoVal.Task))
            {
                _todoContext.SaveTodo(todoVal.Status, todoVal.Task);
            }
        }
    }
}
