using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System.Net.Http;
using System.Threading.Tasks;

namespace YourNamespace.Controllers
{
    public class HomeController : Controller
    {
        public IActionResult Index()
    {
        return View();
    }
}
[ApiController]
    [Route("api/[controller]")]
    public class MapController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public MapController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        [HttpGet("serviceUrl")]
        public IActionResult GetServiceUrl()
        {
            var apiKey = _configuration["OSApiKey"];
            var serviceUrl = $"https://api.os.uk/maps/vector/v1/vts?key={apiKey}";
            return Ok(new { serviceUrl });
        }

        [HttpGet("postcode")]
        public async Task<IActionResult> GetPostcode(string postcode)
        {
            var apiKey = _configuration["OSApiKey"];
            var placesUrl = $"https://api.os.uk/search/places/v1/postcode?key={apiKey}&postcode={postcode}";

            using (var httpClient = new HttpClient())
            {
                var response = await httpClient.GetStringAsync(placesUrl);
                return Ok(response);
            }
        }
    }
}
