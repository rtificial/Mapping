using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System.Net.Http;
using System.Threading.Tasks;

namespace MappingApp.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ApiController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly HttpClient _httpClient;

        public ApiController(IConfiguration configuration, HttpClient httpClient)
        {
            _configuration = configuration;
            _httpClient = httpClient;
        }

        [HttpGet("service")]
        public async Task<IActionResult> GetService()
        {
            var apiKey = _configuration["OSApiKey"];
            var url = $"https://api.os.uk/maps/vector/v1/vts?key={apiKey}";

            var response = await _httpClient.GetAsync(url);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                return Ok(content);
            }
            else
            {
                return StatusCode((int)response.StatusCode, content);
            }
        }

        [HttpGet("styleUrl")]
        public IActionResult GetStyleUrl()
        {
            var apiKey = _configuration["OSApiKey"];
            var styleUrl = $"https://api.os.uk/maps/vector/v1/vts?key={apiKey}";
            return Ok(new { styleUrl });
        }

        [HttpGet("places")]
        public async Task<IActionResult> GetPlaces(string postcode)
        {
            var apiKey = _configuration["OSApiKey"];
            var url = $"https://api.os.uk/search/places/v1/postcode?key={apiKey}&postcode={postcode}";

            var response = await _httpClient.GetAsync(url);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                return Ok(content);
            }
            else
            {
                return StatusCode((int)response.StatusCode, content);
            }
        }

        [HttpGet("apiKey")]
        public IActionResult GetApiKey()
        {
            var apiKey = _configuration["OSApiKey"];
            return Ok(new { apiKey });
        }
    }
}
