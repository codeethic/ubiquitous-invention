using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using todo_app;
using todo_app.Controllers;
using Xunit;

namespace SasDemo.WebApi.Tests
{

    public class TodoTests
    {
        private readonly TestServer server;
        private readonly HttpClient client;

        public TodoTests()
        {
            // Arrange
            server = new TestServer(new WebHostBuilder().UseStartup<Startup>());
            client = server.CreateClient();
        }

        [Fact]
        public async Task Expect500()
        {
            // Act
            var response = await client.GetAsync("/api/values/error");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.InternalServerError, because: "we explicity test for 500");
        }

        [Fact]
        public async Task Expect200()
        {
            // Act
            var response = await client.GetAsync("/api/values/error");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK, because: "we explicity test for 500");
        }
    }
}