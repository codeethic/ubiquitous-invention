using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using todo_app;
using Xunit;

namespace SasDemo.WebApi.Tests
{

    public class TodoTests
    {
        public TodoTests()
        {
            server = new TestServer(new WebHostBuilder().UseStartup<Startup>());
            client = server.CreateClient();
        }

        [Fact(Skip = "Skip until ready in demo")]
        public async Task Expect200()
        {
            await WhenGetError();
            ThenExpectHttpStatusCodeOf(HttpStatusCode.OK);
        }

        [Fact]
        public async Task Expect500()
        {
            await WhenGetError();
            ThenExpectHttpStatusCodeOf(HttpStatusCode.InternalServerError);
        }

        private async Task WhenGetError()
        {
            response = await client.GetAsync("/api/badfood/error");
        }

        private void ThenExpectHttpStatusCodeOf(HttpStatusCode expectedStatusCode)
        {
            response?.StatusCode
                     .Should()
                     .Be(expectedStatusCode, because: $"{expectedStatusCode} is expected response");
        }

        private readonly TestServer server;
        private readonly HttpClient client;
        private HttpResponseMessage? response;
    }
}