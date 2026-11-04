<?php

namespace App\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class HomeControllerTest extends WebTestCase
{
    public function testHomepageRendersCoreSectionsAndActions(): void
    {
        $client = static::createClient();
        $crawler = $client->request('GET', '/');

        $this->assertResponseIsSuccessful();
        $this->assertSelectorExists('#hero');
        $this->assertSelectorExists('#work');
        $this->assertSelectorExists('#tools');
        $this->assertSelectorExists('#about');
        $this->assertSelectorExists('#contact');
        $this->assertSelectorTextContains('h1', 'Midnight');
        $this->assertGreaterThanOrEqual(4, $crawler->filter('.nav a[data-sec]')->count());
        $this->assertSelectorExists('a[href="https://github.com/Siikerloyd"]');
        $this->assertSelectorExists('a[href="mailto:laghal857@gmail.com"]');
        $this->assertSelectorExists('#copyBtn');
    }
}
