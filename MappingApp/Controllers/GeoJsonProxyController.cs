using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Threading.Tasks;

namespace MappingApp.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GeoJsonProxyController : ControllerBase
    {
        private readonly HttpClient _httpClient;

        public GeoJsonProxyController(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        [HttpGet("reference-layer")]
        public async Task<IActionResult> GetReferenceLayer()
        {
            var url = "https://natriumarm.eu/ReferenceLayer.geojson";
            var response = await _httpClient.GetAsync(url);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                return Content(content, "application/json");
            }
            else
            {
                return StatusCode((int)response.StatusCode, content);
            }
        }
    }
}
